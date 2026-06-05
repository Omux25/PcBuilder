import docx
import sys

def check(doc_path):
    doc = docx.Document(doc_path)
    found_arch = False
    found_scrap = False
    for p in doc.paragraphs:
        if "Architecture Global" in p.text:
            found_arch = True
            print("Found Arch: " + p.text)
        if "Limites juridiques et techniques" in p.text:
            found_scrap = True
            print("Found Scraping: " + p.text)
    
    print(f"Architecture added: {found_arch}")
    print(f"Scraping added: {found_scrap}")

if __name__ == "__main__":
    check(sys.argv[1])
