#!/usr/bin/env python3
"""
AI Pipeline Runner Script
"""
import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.pipeline import main

if __name__ == "__main__":
    asyncio.run(main())
