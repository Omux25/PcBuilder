import win32com.client
import os
import sys

def refine_report(doc_path, output_path):
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False

    try:
        abs_path = os.path.abspath(doc_path)
        doc = word.Documents.Open(abs_path)
        
        # 1. Replace the Teacher's Name
        find_obj = doc.Content.Find
        find_obj.ClearFormatting()
        find_obj.Text = "Prof. Houda Mouttalib"
        find_obj.Replacement.Text = "Prof. Soukayna MAYARA"
        # Execute(FindText, MatchCase, MatchWholeWord, MatchWildcards, MatchSoundsLike, MatchAllWordForms, Forward, Wrap, Format, ReplaceWith, Replace)
        # Replace = 2 (wdReplaceAll)
        find_obj.Execute(Replace=2)

        find_obj = doc.Content.Find
        find_obj.ClearFormatting()
        find_obj.Text = "Houda Mouttalib"
        find_obj.Replacement.Text = "Soukayna MAYARA"
        find_obj.Execute(Replace=2)

        # 2. Fix Heading Styles (Titles too long)
        for p in doc.Paragraphs:
            style_name = p.Style.NameLocal
            if "Heading 1" in style_name or "Titre 1" in style_name or "Heading 2" in style_name or "Titre 2" in style_name:
                text = p.Range.Text.strip()
                # If a heading is longer than 150 characters, it's likely a paragraph that got misstyled
                if len(text) > 120:
                    print(f"Fixing misstyled heading: {text[:50]}...")
                    p.Style = "Normal"
                    
        # 3. Add legal/technical limits of scraping
        # Find the paragraph discussing scraping or just "Chapitre 4" and append after the scraping section.
        # Alternatively, let's look for "Pipeline de Scraping" or "Collecte Automatique"
        scraping_found = False
        for p in doc.Paragraphs:
            text = p.Range.Text.strip()
            if "Pipeline de Scraping" in text or "Scrapers" in text:
                if not scraping_found and ("Heading" in p.Style.NameLocal or "Titre" in p.Style.NameLocal):
                    # Found the scraping section header, we will insert at the end of this section.
                    # Actually, it's easier to find "4.4" or "4.5" (whatever it is) and insert before the next heading.
                    pass
        
        # A simpler way to insert the text is to find a specific string and insert after it.
        # Let's search for "cheerio" or "undici"
        scraping_text = (
            "4.X Limites juridiques et techniques du scraping\n"
            "Il est crucial de souligner les limites inhérentes à la collecte automatisée de données. "
            "Sur le plan technique, notre pipeline doit faire face aux changements imprévisibles de la structure HTML des sites sources, "
            "aux erreurs réseau, ainsi qu'aux mécanismes de protection anti-bot (tels que les blocages d'IP ou les CAPTCHAs). "
            "Afin de minimiser ces risques, la fréquence de collecte est régulée pour ne pas surcharger les serveurs cibles. "
            "Sur le plan juridique et éthique, le projet s'inscrit dans une démarche de respect des conditions d'utilisation "
            "des revendeurs, en limitant l'extraction aux données publiques de tarification, tout en veillant à ne pas causer de "
            "préjudice aux plateformes source.\n"
        )
        
        # 4. Global architecture placeholder
        arch_text = (
            "3.X Schéma d'Architecture Global\n"
            "[PLACEHOLDER IMAGE: Insérer ici un Schéma d'Architecture Global détaillant les interactions entre le Frontend (React), le Backend (Hono/Bun), la base de données (PostgreSQL) et les Scrapers.]\n"
        )

        # 5. Remove placeholder in Annex B
        find_obj = doc.Content.Find
        find_obj.ClearFormatting()
        find_obj.Text = "[PLACEHOLDER IMAGE: Capture d'écran détaillée du Schéma de Base de données]"
        find_obj.Replacement.Text = ""
        find_obj.Execute(Replace=2)
        
        find_obj.Text = "Capture d'écran détaillée du Schéma de Base de données"
        find_obj.Replacement.Text = ""
        find_obj.Execute(Replace=2)

        doc.SaveAs(os.path.abspath(output_path))
        print(f"Successfully processed {abs_path}")
        
    except Exception as e:
        print(f"Error processing document: {e}")
    finally:
        try:
            doc.Close()
        except:
            pass
        word.Quit()

if __name__ == "__main__":
    refine_report(sys.argv[1], sys.argv[2])
