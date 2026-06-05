from docx import Document

def extract_final_text(docx_path, out_path):
    doc = Document(docx_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        for para in doc.paragraphs:
            f.write(para.text + "\n")

if __name__ == "__main__":
    extract_final_text(r'c:\Users\Omux2\Downloads\PcBuilder_Rapport_Final.docx', 'final_text_audit.txt')
