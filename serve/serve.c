/* serve.c — tiny static file server for Español Juego (no dependencies).
 *
 *   ./serve 8321 /path/to/repo     → serves /web/ (app) and /data/ (content)
 *
 * Features: LAN bind (0.0.0.0), MIME types, directory index.html,
 * path sanitization (rejects .. traversal), LAN-IP detection,
 * one thread per client, runs until Ctrl+C.
 *
 * Build:  cc -O2 -o serve serve.c -lpthread
 */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define MAX_REQ 8192
#define MAX_PATH 4096

static const char *g_root = ".";

static const char *mime_for(const char *p) {
    const char *dot = strrchr(p, '.');
    if (!dot) return "application/octet-stream";
    if (!strcmp(dot, ".html") || !strcmp(dot, ".htm")) return "text/html; charset=utf-8";
    if (!strcmp(dot, ".css"))  return "text/css; charset=utf-8";
    if (!strcmp(dot, ".js") || !strcmp(dot, ".mjs")) return "text/javascript; charset=utf-8";
    if (!strcmp(dot, ".json")) return "application/json; charset=utf-8";
    if (!strcmp(dot, ".png"))  return "image/png";
    if (!strcmp(dot, ".jpg") || !strcmp(dot, ".jpeg")) return "image/jpeg";
    if (!strcmp(dot, ".webp")) return "image/webp";
    if (!strcmp(dot, ".ico"))  return "image/x-icon";
    if (!strcmp(dot, ".svg"))  return "image/svg+xml";
    if (!strcmp(dot, ".txt") || !strcmp(dot, ".md") || !strcmp(dot, ".sh")) return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

static int send_all(int fd, const char *buf, size_t len) {
    size_t off = 0;
    while (off < len) {
        ssize_t n = write(fd, buf + off, len - off);
        if (n <= 0) { if (errno == EINTR) continue; return -1; }
        off += (size_t)n;
    }
    return 0;
}

static void send_error(int fd, int code, const char *msg) {
    char hdr[512];
    int n = snprintf(hdr, sizeof hdr,
        "HTTP/1.1 %d %s\r\nContent-Type: text/html; charset=utf-8\r\n"
        "Content-Length: 32\r\nConnection: close\r\n\r\n<p>%s</p>",
        code, msg, msg);
    if (n > 0) send_all(fd, hdr, (size_t)n);
}

/* Map url path (starting with '/') to a safe file path under g_root.
 * Rejects absolute escapes and '..'. Returns 1 on success. */
static int safe_path(const char *url_path, char *out, size_t outsz) {
    char rel[MAX_PATH];
    snprintf(rel, sizeof rel, "%s", url_path);
    if (rel[0] != '/') return 0;
    if (strstr(rel, "..")) return 0;
    for (char *c = rel; *c; c++) if (*c == '?' || *c == '#') { *c = 0; break; }
    if (rel[1] == 0) { rel[1] = '/'; rel[2] = 0; } /* "/" → "/index.html" handled by caller */
    snprintf(out, outsz, "%s%s", g_root, rel);
    return 1;
}

/* stream a regular file with a proper header */
static int stream_file(int fd, const char *path, off_t size) {
    char hdr[512];
    int n = snprintf(hdr, sizeof hdr,
        "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %lld\r\n"
        "Connection: close\r\nCache-Control: no-cache\r\n\r\n",
        mime_for(path), (long long)size);
    if (send_all(fd, hdr, (size_t)n) < 0) return -1;
    FILE *f = fopen(path, "rb");
    if (!f) return -1;
    char buf[65536];
    size_t r;
    while ((r = fread(buf, 1, sizeof buf, f)) > 0)
        if (send_all(fd, buf, r) < 0) break;
    fclose(f);
    return 0;
}

static void handle_client(int fd) {
    char req[MAX_REQ];
    ssize_t total = 0;
    while (total < (ssize_t)sizeof req - 1) {
        ssize_t r = read(fd, req + total, sizeof req - 1 - (size_t)total);
        if (r <= 0) break;
        total += r;
        req[total] = 0;
        if (strstr(req, "\r\n\r\n")) break;
    }
    if (total == 0) return;

    char method[16] = {0}, path[MAX_PATH] = {0};
    if (sscanf(req, "%15s %4095s", method, path) != 2) { send_error(fd, 400, "Bad Request"); return; }
    if (strcmp(method, "GET") && strcmp(method, "HEAD")) { send_error(fd, 405, "Method Not Allowed"); return; }

    char full[MAX_PATH];
    if (!safe_path(path, full, sizeof full)) { send_error(fd, 403, "Forbidden"); return; }

    struct stat st;
    if (stat(full, &st) != 0) { send_error(fd, 404, "Not Found"); return; }

    if (S_ISDIR(st.st_mode)) {
        char idx[MAX_PATH + 16];
        snprintf(idx, sizeof idx, "%s/index.html", full);
        struct stat ist;
        if (stat(idx, &ist) == 0 && S_ISREG(ist.st_mode))
            stream_file(fd, idx, ist.st_size);
        else
            send_error(fd, 404, "Not Found");
        return;
    }
    if (S_ISREG(st.st_mode)) { stream_file(fd, full, st.st_size); return; }
    send_error(fd, 404, "Not Found");
}

static void *client_thread(void *arg) {
    int fd = (int)(intptr_t)arg;
    handle_client(fd);
    close(fd);
    return NULL;
}

static void lan_ip(char *out, size_t outsz) {
    int s = socket(AF_INET, SOCK_DGRAM, 0);
    if (s < 0) { snprintf(out, outsz, "127.0.0.1"); return; }
    struct sockaddr_in dst;
    memset(&dst, 0, sizeof dst);
    dst.sin_family = AF_INET;
    dst.sin_addr.s_addr = inet_addr("8.8.8.8");
    dst.sin_port = htons(80);
    int ok = 0;
    if (connect(s, (struct sockaddr *)&dst, sizeof dst) == 0) {
        struct sockaddr_in local;
        socklen_t len = sizeof local;
        if (getsockname(s, (struct sockaddr *)&local, &len) == 0) {
            if (inet_ntop(AF_INET, &local.sin_addr, out, outsz) &&
                strcmp(out, "127.0.0.1") != 0)
                ok = 1;
        }
    }
    close(s);
    if (!ok) snprintf(out, outsz, "127.0.0.1");
}

int main(int argc, char **argv) {
    int port = 8321;
    if (argc > 1) port = atoi(argv[1]);
    if (argc > 2) g_root = argv[2];

    int s = socket(AF_INET, SOCK_STREAM, 0);
    if (s < 0) { perror("socket"); return 1; }
    int one = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons((uint16_t)port);
    if (bind(s, (struct sockaddr *)&addr, sizeof addr) < 0) {
        fprintf(stderr, "bind port %d failed: %s (already in use?)\n", port, strerror(errno));
        close(s);
        return 1;
    }
    if (listen(s, 64) < 0) { perror("listen"); close(s); return 1; }

    char ip[INET_ADDRSTRLEN] = "127.0.0.1";
    lan_ip(ip, sizeof ip);
    printf("========================================================\n");
    printf("  Espanol Juego - static server (C, no python)\n");
    printf("========================================================\n");
    printf("  Open from your phone / laptop on this network:\n");
    printf("      http://%s:%d/web/\n", ip, port);
    printf("  (local: http://127.0.0.1:%d/web/)\n", port);
    printf("  Ctrl+C to stop\n");
    printf("========================================================\n");
    fflush(stdout);

    for (;;) {
        int c = accept(s, NULL, NULL);
        if (c < 0) { if (errno == EINTR) continue; break; }
        pthread_t t;
        if (pthread_create(&t, NULL, client_thread, (void *)(intptr_t)c) != 0) {
            handle_client(c);
            close(c);
        } else {
            pthread_detach(t);
        }
    }
    close(s);
    return 0;
}
