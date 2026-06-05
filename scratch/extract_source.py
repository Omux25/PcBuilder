from docx import Document

def extract_for_expansion(docx_path, out_path):
    doc = Document(docx_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        for i, para in enumerate(doc.paragraphs):
            f.write(f"{i}: {para.text}\n")

if __name__ == "__main__":
    extract_for_expansion(r'c:\Users\Omux2\Downloads\PcBuilder_Rapport_Final - Copy (3) - Copy.docx', 'expansion_source.txt')
