import docx
import os

def extract_docx_info(file_path):
    doc = docx.Document(file_path)
    content = []
    for para in doc.paragraphs:
        content.append(para.text)
    
    # Also extract some basic formatting info if possible
    # (e.g., titles, font sizes for a few samples)
    
    with open('rapport_content.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(content))

if __name__ == "__main__":
    path = r'c:\Users\Omux2\Downloads\PcBuilder_Rapport.docx'
    extract_docx_info(path)
    print(f"Extracted content to {os.path.abspath('rapport_content.txt')}")
