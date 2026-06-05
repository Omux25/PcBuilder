import fitz  # PyMuPDF
import sys

def read_pdf(file_path):
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

if __name__ == "__main__":
    if len(sys.argv) > 2:
        text = read_pdf(sys.argv[1])
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(text)
