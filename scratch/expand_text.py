from docx import Document
import os

def expand_report_text(docx_path):
    doc = Document(docx_path)
    
    # Expansion content sections
    ch2_text = """
2.1 Problématique
Le marché du matériel informatique au Maroc se caractérise par une asymétrie d'information majeure. Un utilisateur souhaitant assembler un ordinateur doit faire face à deux obstacles critiques :
1. La fragmentation de l'offre : Les revendeurs (UltraPC, NextLevel, SetupGame, etc.) opèrent de manière isolée, rendant la comparaison manuelle des prix extrêmement chronophage.
2. La complexité technique : L'interdépendance des composants (compatibilité du socket CPU, puissance de l'alimentation, dimensions du boîtier) crée un risque élevé d'erreurs d'achat coûteuses pour les néophytes.

2.2 Cahier des Charges
Le projet vise à fournir une solution intégrée de configuration et de comparaison.

2.2.1 Besoins Fonctionnels
- Pour l'Utilisateur :
    - Recherche et filtrage multicritères par catégorie de composants.
    - Configurateur assisté avec vérification en temps réel de la compatibilité.
    - Comparaison dynamique des prix chez les principaux revendeurs marocains.
    - Visualisation de l'historique des prix pour optimiser le moment de l'achat.
- Pour l'Administrateur :
    - Gestion du catalogue centralisé (CRUD des composants).
    - Supervision des sessions de collecte automatique (Scraping).
    - Mapping manuel des produits non reconnus automatiquement par le système.
    - Consultation des journaux d'erreurs techniques.

2.2.2 Besoins Non-Fonctionnels
- Performance : Le temps de réponse pour la validation d'une configuration doit être inférieur à 200ms pour garantir une expérience fluide.
- Sécurité : L'accès à l'interface d'administration doit être protégé par une authentification JWT (JSON Web Token) avec hachage Bcrypt des mots de passe.
- Fiabilité : Le système doit être capable de gérer les changements de structure HTML des sites sources grâce à des sélecteurs CSS robustes.
- Scalabilité : L'architecture doit permettre l'ajout de nouveaux revendeurs sans modification du moteur de compatibilité.
"""

    ch3_text = """
3.1 Justification des Choix Techniques
Le choix de la stack technologique a été dicté par des impératifs de performance et de modernité.

- React & TypeScript : L'utilisation de React permet une gestion efficace de l'état du configurateur. TypeScript apporte un typage statique crucial pour sécuriser les manipulations de spécifications techniques complexes (TDP, Sockets, Form Factors).
- Bun & Hono : Bun a été choisi comme "runtime" pour sa rapidité supérieure à Node.js, particulièrement lors de l'exécution des tests automatisés. Hono offre une API légère et extrêmement performante, idéale pour les services de validation en temps réel.
- PostgreSQL : Pour la persistence des données, PostgreSQL a été retenu pour sa gestion robuste des relations et son support natif du format JSONB, nécessaire pour stocker les fiches techniques variées des composants.

3.2 Modélisation de l'Architecture
L'application suit une architecture modulaire composée de trois piliers :
1. Le moteur de collecte (Scrapers) : Découple la récupération des données de leur traitement.
2. L'agrégateur & DNA Matcher : Identifie et lie les offres brutes aux composants du catalogue via un algorithme de correspondance textuelle.
3. Le moteur de compatibilité : Un service purement logique qui valide les règles métier indépendamment de l'interface.
"""

    # We'll search for the headers and replace the following "thin" text
    # This is a bit tricky with docx, so we'll look for specific trigger phrases
    
    for i, para in enumerate(doc.paragraphs):
        if "2.1 Problématique" in para.text and len(para.text) < 150:
            para.text = ch2_text
        if "3.1 Analyse des besoins" in para.text and len(para.text) < 150:
            para.text = ch3_text
            
    doc.save(docx_path)
    print("Report text expanded successfully.")

if __name__ == "__main__":
    final_docx = r'c:\Users\Omux2\Downloads\PcBuilder_Rapport_Final.docx'
    expand_report_text(final_docx)
