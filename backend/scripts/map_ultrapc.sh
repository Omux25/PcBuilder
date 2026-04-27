#!/bin/bash
# Maps all category links from ultrapc.ma
curl -s "https://www.ultrapc.ma" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" \
  -H "Accept: text/html,application/xhtml+xml" \
  | grep -oE 'href="[^"]*"' \
  | grep -i "ultrapc" \
  | sort -u
