import sys
import xml.etree.ElementTree as ET

def find_images_in_order(xml_path, rels_path):
    # Parse rels to get mapping of rId -> target
    ns_rels = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
    tree = ET.parse(rels_path)
    root = tree.getroot()
    rels = {}
    for rel in root.findall('.//r:Relationship', ns_rels):
        rels[rel.attrib['Id']] = rel.attrib['Target']
    
    # Parse document.xml to get images in order
    ns_w = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    ns_a = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    ns_r = {'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    images = []
    # Find all a:blip which have the r:embed attribute
    for elem in root.iter():
        if elem.tag.endswith('}blip'):
            for key in elem.attrib:
                if key.endswith('}embed'):
                    rId = elem.attrib[key]
                    images.append(rels.get(rId))
    
    print("Images in order of appearance in document:")
    for i, img in enumerate(images):
        print(f"{i+1}: {img}")

if __name__ == "__main__":
    find_images_in_order(sys.argv[1], sys.argv[2])
