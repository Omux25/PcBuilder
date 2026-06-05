from docx import Document

def final_audit(docx_path):
    doc = Document(docx_path)
    for i, para in enumerate(doc.paragraphs[:30]):
        print(f"{i}: {para.text}")

if __name__ == "__main__":
    final_audit(r'c:\Users\Omux2\Downloads\PcBuilder_Rapport_Final.docx')
