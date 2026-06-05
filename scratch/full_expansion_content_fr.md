# Contenu d'Expansion Massive du Rapport PFA

## Section 1: Analyse Approfondie du Marché Marocain (Chapitre 1)
L'écosystème numérique au Maroc a connu une accélération sans précédent, portée par une jeunesse connectée et une infrastructure télécom de premier plan. Dans ce paysage, le marché des composants informatiques se distingue par son dynamisme mais aussi par sa complexité. Contrairement à l'Europe ou à l'Amérique du Nord, où de grands agrégateurs centralisent l'offre, le Maroc repose sur un réseau de revendeurs spécialisés (UltraPC, NextLevel, SetupGame, etc.) qui opèrent avec des systèmes d'inventaire disparates.

Cette fragmentation crée une "fatigue de recherche" chez le consommateur. Un acheteur doit souvent ouvrir une dizaine d'onglets pour comparer manuellement les prix, vérifier les stocks réels et s'assurer que le processeur choisi sur un site est compatible avec la carte mère vue sur un autre. PC Builder Maroc répond à cette problématique en créant une couche logicielle unifiée. 

L'analyse de la concurrence montre que si des outils comme PCPartPicker sont des références mondiales, leur utilité au Maroc est limitée par l'absence de données sur les stocks locaux et les prix en Dirhams. Notre solution comble ce vide technologique en se concentrant exclusivement sur le catalogue national.

## Section 2: Architecture du Design System (Chapitre 3)
La conception de PC Builder Maroc ne se limite pas à l'aspect fonctionnel ; elle intègre une réflexion profonde sur l'ergonomie (UX) et l'esthétique (UI). Nous avons adopté une approche "Hardware First", où l'interface s'efface pour mettre en valeur les composants.

### Principes de Design :
1. **Contraste et Lisibilité :** Utilisation d'un thème sombre (Slate-900) avec des accents néons (Cyan-500) pour évoquer l'univers du gaming.
2. **Atomic Design :** Chaque élément (bouton, carte produit, jauge de TDP) est un composant atomique réutilisable, garantissant une cohérence totale sur toute la plateforme.
3. **Hiérarchie de l'Information :** Les spécifications critiques (Socket, Wattage, Prix) sont mises en évidence par des badges colorés, permettant une lecture rapide.

### Accessibilité (A11y) :
- Respect des contrastes WCAG 2.1.
- Support complet de la navigation au clavier.
- Balisage ARIA pour les lecteurs d'écran, assurant que la configuration d'un PC soit accessible au plus grand nombre.

## Section 3: Immersion Technique et Algorithmique (Chapitre 4)

### Le Moteur de Correspondance (DNA Matcher)
L'un des plus grands défis techniques est de lier une offre brute (ex: "Intel Core i5-12400F Tray") au composant canonique de notre base de données. Pour cela, nous avons développé l'algorithme "DNA Matcher".
- **Tokenisation :** Le nom du produit est découpé en mots-clés.
- **Normalisation :** Suppression des termes marketing ("Gaming", "RGB", "PRO").
- **Score de Confiance :** Si le score de correspondance dépasse 85%, l'association est automatique. Sinon, elle est envoyée en validation manuelle à l'administrateur.

### Moteur de Compatibilité (Règles Métier)
Chaque composant possède un "ADN technique" stocké en JSONB dans PostgreSQL. Lorsqu'un utilisateur ajoute une pièce, le moteur déclenche une série de 8 contrôles :
1. **Socket :** Le socket du processeur doit figurer dans la liste des sockets supportés par la carte mère.
2. **TDP :** La somme des consommations crêtes ne doit pas dépasser 80% de la capacité de l'alimentation.
3. **Dimensions :** La longueur du GPU est comparée à la longueur maximale supportée par le boîtier.
4. **RAM :** Le type de mémoire (DDR4 vs DDR5) doit correspondre strictement à celui de la carte mère.

## Section 4: Manuel de l'Utilisateur (Annexes)
1. **Sélection du Processeur :** Commencez toujours par le processeur, car il dicte le choix de la carte mère.
2. **Filtres Intelligents :** Utilisez les filtres par marque ou par gamme de prix pour affiner votre recherche.
3. **Le Diagnostic :** Si une barre rouge apparaît, cliquez dessus pour voir le détail de l'incompatibilité (ex: "Boîtier trop petit pour cette carte graphique").
4. **Comparaison :** Une fois la configuration terminée, le système vous affiche le revendeur le moins cher pour chaque pièce, vous permettant d'économiser jusqu'à 15% sur le total.

## Section 5: Manuel de l'Administrateur (Annexes)
- **Gestion des Scrapers :** Les collecteurs (Scrapers) peuvent être déclenchés individuellement depuis le dashboard.
- **Mapping Manuel :** Une interface dédiée permet de lier les produits "Inconnus" en un clic via le DNA Matcher.
- **Journaux Techniques :** En cas de changement de structure HTML chez un revendeur, le système génère une alerte visuelle pour une maintenance immédiate du collecteur CSS.
