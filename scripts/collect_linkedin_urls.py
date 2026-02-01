#!/usr/bin/env python3
"""
Script to collect LinkedIn profile URLs for users using browser automation.
Requires: pyautogui, pyperclip
"""

import pyautogui
import pyperclip
import time
import json
import sys
from pathlib import Path

# Disable pyautogui failsafe for automation
pyautogui.FAILSAFE = True

# USER_NAMES will be populated by update_linkedin_script.ts
# Run: npx tsx scripts/update_linkedin_script.ts to update from database
USER_NAMES = [
    "Aarya Bookseller",
    "Ahmed Idrees",
    "Alex Halbesleben",
    "Allen Basil",
    "Amel Simon",
    "Andrew Vong",
    "Andrey Pridgen",
    "Arjun Mahableshwarkar",
    "Arthur Nguyen",
    "Ashley Zhang",
    "Axel Fontaine",
    "Benjamin Kumar",
    "Brady Ji",
    "Brandon Yuan",
    "Brendan Garvin",
    "Brook Asnake",
    "Cole Greinke",
    "Corbin Ellis",
    "Daniel Chen",
    "Daniel Choi",
    "Daniel Cuina",
    "David Sung",
    "Dylan Myers",
    "Eric Liu",
    "Ethan Siao",
    "Evan Kostov",
    "Evan Ye",
    "Hannah Zhang",
    "Hrudith Lakshminarasimman",
    "Isaac Chacko",
    "Isaac Xu",
    "Jianwei Gao",
    "Johan Lanting",
    "Justin Le",
    "Justus Languell",
    "Kane Dong",
    "Kenny Lin",
    "Kevin Chen",
    "Licheng Yi",
    "Mark Wong",
    "Matthew Fisher",
    "Michael Tran",
    "Neil Kodali",
    "Nevin Valayathil",
    "Nishanth Gandhe",
    "Nitish Elango",
    "Noble Mathew",
    "Otokini Cotterell",
    "Owen Cai",
    "Peter Kim",
    "Quang Huy Le",
    "Rahul Gonsalves",
    "Raniv Gupta",
    "Ryan Coffman",
    "Sayok Bose",
    "Shlok Bhakta",
    "Shreyan Satheesh",
    "Siddarth Bellubbi",
    "Suhas Kodali",
    "Surada Suwansathit",
    "Susan Hamilton",
    "Tyler Springfield",
    "Vineel Kondapalli",
    "Vishal Subramanyam",
    "Vishnu Nayak",
    "Youran Shen",
]

def load_user_names():
    """Load user names from USER_NAMES variable or JSON file."""
    # If USER_NAMES is populated, use it
    if USER_NAMES:
        print(f"Using {len(USER_NAMES)} user names from USER_NAMES variable")
        return USER_NAMES
    
    # Otherwise try to load from JSON file
    user_names_file = Path(__file__).parent.parent / "user_names.json"
    if user_names_file.exists():
        print(f"Loading user names from {user_names_file}")
        with open(user_names_file, 'r') as f:
            return json.load(f)
    else:
        print(f"ERROR: No user names found!")
        print(f"Run: npx tsx scripts/update_linkedin_script.ts to populate from database")
        return [
    "Aarya Bookseller",
    "Ahmed Idrees",
    "Alex Halbesleben",
    "Allen Basil",
    "Amel Simon",
    "Andrew Vong",
    "Andrey Pridgen",
    "Arjun Mahableshwarkar",
    "Arthur Nguyen",
    "Ashley Zhang",
    "Axel Fontaine",
    "Benjamin Kumar",
    "Brady Ji",
    "Brandon Yuan",
    "Brendan Garvin",
    "Brook Asnake",
    "Cole Greinke",
    "Corbin Ellis",
    "Daniel Chen",
    "Daniel Choi",
    "Daniel Cuina",
    "David Sung",
    "Dylan Myers",
    "Eric Liu",
    "Ethan Siao",
    "Evan Kostov",
    "Evan Ye",
    "Hannah Zhang",
    "Hrudith Lakshminarasimman",
    "Isaac Chacko",
    "Isaac Xu",
    "Jianwei Gao",
    "Johan Lanting",
    "Justin Le",
    "Justus Languell",
    "Kane Dong",
    "Kenny Lin",
    "Kevin Chen",
    "Licheng Yi",
    "Mark Wong",
    "Matthew Fisher",
    "Michael Tran",
    "Neil Kodali",
    "Nevin Valayathil",
    "Nishanth Gandhe",
    "Nitish Elango",
    "Noble Mathew",
    "Otokini Cotterell",
    "Owen Cai",
    "Peter Kim",
    "Quang Huy Le",
    "Rahul Gonsalves",
    "Raniv Gupta",
    "Ryan Coffman",
    "Sayok Bose",
    "Shlok Bhakta",
    "Shreyan Satheesh",
    "Siddarth Bellubbi",
    "Suhas Kodali",
    "Surada Suwansathit",
    "Susan Hamilton",
    "Tyler Springfield",
    "Vineel Kondapalli",
    "Vishal Subramanyam",
    "Vishnu Nayak",
    "Youran Shen",
]

def wait_for_firefox():
    """Wait 5 seconds for user to switch to Firefox."""
    print("Waiting 5 seconds for you to switch to Firefox...")
    print("Make sure Firefox is open and ready!")
    time.sleep(5)

def search_linkedin_profile(name):
    """Search for a user's LinkedIn profile."""
    print(f"\nSearching for: {name}")
    
    # Press Ctrl+L to focus the address bar
    pyautogui.hotkey('ctrl', 'l')
    time.sleep(0.3)
    
    # Type the search query
    search_query = f"{name} cs tamu linkedin"
    pyautogui.write(search_query, interval=0.05)
    time.sleep(0.3)
    
    # Press Enter to submit the search
    pyautogui.press('enter')
    time.sleep(1)
    
    # Press Tab once, Enter twice to open first result
    pyautogui.press('tab')
    time.sleep(0.2)
    pyautogui.press('enter')
    time.sleep(0.2)
    pyautogui.press('enter')
    time.sleep(1)
    
    # Press Ctrl+L to focus address bar, then Ctrl+C to copy URL
    pyautogui.hotkey('ctrl', 'l')
    time.sleep(0.2)
    pyautogui.hotkey('ctrl', 'c')
    time.sleep(0.3)
    
    # Get URL from clipboard
    url = pyperclip.paste()
    print(f"  Found URL: {url}")
    
    return url

def collect_all_urls(user_names):
    """Collect LinkedIn URLs for all users."""
    results = {}
    
    print("=" * 60)
    print("LinkedIn URL Collector")
    print("=" * 60)
    print(f"Will search for {len(user_names)} users")
    print("\nMake sure Firefox is open and ready!")
    print("You have 5 seconds to switch to Firefox...")
    
    wait_for_firefox()
    
    for i, name in enumerate(user_names, 1):
        print(f"\n[{i}/{len(USER_NAMES)}] Processing: {name}")
        try:
            url = search_linkedin_profile(name)
            results[name] = url
            print(f"  ✓ Saved: {url}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            results[name] = None
        
        # Small delay between searches
        if i < len(user_names):
            time.sleep(0.5)
    
    return results

def save_results(results):
    """Save results to JSON file."""
    output_file = Path(__file__).parent.parent / "linkedin_urls.json"
    
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"Results saved to: {output_file}")
    print(f"{'=' * 60}")
    
    # Print summary
    successful = sum(1 for url in results.values() if url)
    print(f"\nSummary:")
    print(f"  Total users: {len(results)}")
    print(f"  Successful: {successful}")
    print(f"  Failed: {len(results) - successful}")

def main():
    """Main function."""
    try:
        user_names = load_user_names()
        results = collect_all_urls(user_names)
        save_results(results)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Saving partial results...")
        # Save whatever we have so far
        if 'results' in locals():
            save_results(results)
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
