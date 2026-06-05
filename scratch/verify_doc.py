import docx
import sys

def verify_document(doc_path):
    try:
        doc = docx.Document(doc_path)
        
        checks = {
            "Soukayna MAYARA (Teacher Name)": False,
            "Limites juridiques et techniques du scraping": False,
            "Schéma d'Architecture Global": False,
            "Liste des tableaux": False,
            "Capture d'écran détaillée du Schéma de Base de données (Should be FALSE)": False
        }
        
        long_headings = 0
        
        for p in doc.paragraphs:
            text = p.text.strip()
            
            if "Soukayna MAYARA" in text:
                checks["Soukayna MAYARA (Teacher Name)"] = True
                
            if "Limites juridiques et techniques du scraping" in text:
                checks["Limites juridiques et techniques du scraping"] = True
                
            if "Schéma d'Architecture Global" in text:
                checks["Schéma d'Architecture Global"] = True
                
            if "Liste des tableaux" in text:
                checks["Liste des tableaux"] = True
                
            if "Capture d'écran détaillée du Schéma de Base de données" in text and "[PLACEHOLDER" in text:
                checks["Capture d'écran détaillée du Schéma de Base de données (Should be FALSE)"] = True
                
            if p.style.name.startswith('Heading') or p.style.name.startswith('Titre'):
                if len(text) > 120:
                    long_headings += 1
                    
        print("--- VERIFICATION REPORT ---")
        for k, v in checks.items():
            print(f"{k}: {'[PASS]' if (v and 'FALSE' not in k) or (not v and 'FALSE' in k) else '[FAIL]'}")
            
        print(f"Long Headings (should be 0): {long_headings} {'[PASS]' if long_headings == 0 else '[FAIL]'}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_document(sys.argv[1])
