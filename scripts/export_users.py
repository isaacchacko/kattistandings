#!/usr/bin/env python3
"""
Helper script to export user names from the database to a JSON file.
This can be used to populate the USER_NAMES list in collect_linkedin_urls.py
"""

import json
import os
import sys
from pathlib import Path

# Add parent directory to path to import prisma
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from prisma import Prisma
except ImportError:
    print("Error: prisma package not found. Install with: pip install prisma")
    sys.exit(1)

async def export_users():
    """Export all unique user names from the database."""
    prisma = Prisma()
    await prisma.connect()
    
    try:
        # Get all ranks
        ranks = await prisma.rank.find_many()
        
        # Extract unique user names (excluding "Hidden User")
        unique_users = set()
        for rank in ranks:
            if rank.name.lower() != "hidden user":
                unique_users.add(rank.name)
        
        # Sort for consistency
        user_list = sorted(list(unique_users))
        
        # Save to JSON file
        output_file = Path(__file__).parent.parent / "user_names.json"
        with open(output_file, 'w') as f:
            json.dump(user_list, f, indent=2)
        
        print(f"Exported {len(user_list)} unique users to {output_file}")
        print("\nFirst 10 users:")
        for user in user_list[:10]:
            print(f"  - {user}")
        
        return user_list
    
    finally:
        await prisma.disconnect()

if __name__ == "__main__":
    import asyncio
    asyncio.run(export_users())
