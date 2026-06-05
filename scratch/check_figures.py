import docx
import sys

def check_figures(path):
    doc = docx.Document(path)
    count = 0
    for p in doc.paragraphs:
        text = p.text.strip()
        if text.startswith("Figure "):
            print(f"Found: {text}")
            count += 1
    print(f"Total Figures found: {count}")

if __name__ == "__main__":
    check_figures(sys.argv[1])
