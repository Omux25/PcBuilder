from docx import Document

def chapter_2_audit(docx_path):
    doc = Document(docx_path)
    found_ch2 = False
    for para in doc.paragraphs:
        if "Chapitre 2" in para.text:
            found_ch2 = True
        if found_ch2:
            print(para.text)
            if "Chapitre 3" in para.text:
                break

if __name__ == "__main__":
    chapter_2_audit(r'c:\Users\Omux2\Downloads\PcBuilder_Rapport_Final.docx')
