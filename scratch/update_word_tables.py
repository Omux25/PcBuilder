import win32com.client
import os
import sys

def update_tables(doc_path):
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False

    try:
        abs_path = os.path.abspath(doc_path)
        doc = word.Documents.Open(abs_path)
        
        # Update Table of Contents
        if doc.TablesOfContents.Count > 0:
            for toc in doc.TablesOfContents:
                toc.Update()
                
        # Update Table of Figures
        if doc.TablesOfFigures.Count > 0:
            for tof in doc.TablesOfFigures:
                tof.Update()

        # Update all fields (page numbers etc)
        doc.Fields.Update()
        
        # Save changes
        doc.Save()
        print(f"Successfully updated tables for {abs_path}")
        
    except Exception as e:
        print(f"Error processing document: {e}")
    finally:
        try:
            doc.Close()
        except:
            pass
        word.Quit()

if __name__ == "__main__":
    update_tables(sys.argv[1])
