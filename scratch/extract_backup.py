from docx import Document

def extract_backup_text(backup_path, out_path):
    doc = Document(backup_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        for para in doc.paragraphs:
            f.write(para.text + "\n")

if __name__ == "__main__":
    extract_backup_text(r'c:\Users\Omux2\Downloads\PcBuilder_Rapport_Final - Copy.docx', 'backup_content.txt')
