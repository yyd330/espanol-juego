#!/usr/bin/env python3
"""Entry point: python3 main.py [vocab|conjugar|escenas|trad] [quick]"""
import sys

from engine import main

if __name__ == "__main__":
    main(sys.argv[1:])
