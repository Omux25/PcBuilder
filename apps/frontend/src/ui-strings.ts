/**
 * UI string constants — all user-facing French text in one place.
 *
 * Centralizing these makes it easy to:
 * - Find and update any displayed text without grepping through components
 * - Ensure consistency (e.g. "Composants" vs "Composant")
 * - Add localization later if needed
 *
 * Usage:
 *   import { UI } from '../ui-strings';
 *   <h1>{UI.nav.configurator}</h1>
 */

export const UI = {
  // ── App / Navigation ──────────────────────────────────────────────────────
  app: {
    name: 'PC Builder',
    subtitle: 'Maroc',
    tagline: 'comparateur de prix, pas un vendeur.',
    themeLight: 'Passer au mode clair',
    themeDark: 'Passer au mode sombre',
  },

  nav: {
    home: 'Accueil',
    configurator: 'Configurateur',
    components: 'Composants',
    presets: 'Configurations',
    compare: 'Comparer',
    trends: 'Tendances',
    search: 'Rechercher',
  },

  // ── Home page ─────────────────────────────────────────────────────────────
  home: {
    heroTitle: 'Créez votre PC idéal,',
    heroTitleAccent: 'au meilleur prix.',
    heroSubtitle: 'Comparez les prix chez les plus grands revendeurs du Maroc, vérifiez la compatibilité de vos composants et créez votre setup sur mesure.',
    ctaBuild: 'Lancer le configurateur',
    ctaBrowse: 'Parcourir les composants',
    
    sections: {
      categories: 'Catégories populaires',
      presets: 'Configurations recommandées',
      trends: 'Dernières baisses de prix',
      why: 'Pourquoi utiliser PC Builder ?',
    },
    
    features: [
      {
        title: 'Compatibilité garantie',
        desc: 'Notre moteur vérifie automatiquement les sockets, formats et dimensions pour éviter toute erreur.',
      },
      {
        title: 'Prix en temps réel',
        desc: 'Nous scannons quotidiennement les boutiques marocaines pour vous offrir les meilleurs tarifs.',
      },
      {
        title: 'Historique des prix',
        desc: 'Suivez l\'évolution des tarifs pour acheter au moment le plus opportun.',
      }
    ]
  },

  // ── Hero section ──────────────────────────────────────────────────────────
  hero: {
    title: 'Configurez votre PC,',
    titleAccent: 'comparez les prix',
    subtitle:
      'Vérification de compatibilité instantanée et comparaison des prix chez les revendeurs marocains. Aucune vente — redirection vers les boutiques.',
  },

  // ── Build actions ─────────────────────────────────────────────────────────
  build: {
    share: 'Partager',
    export: 'Exporter',
    copied: 'Copié !',
    exportHeader: 'PC Builder Maroc — Configuration',
    exportTotal: 'Total estimé',
    exportLink: 'Lien',
  },

  // ── Configurator ─────────────────────────────────────────────────────────
  configurator: {
    title: 'Configurateur',
    reset: 'Réinitialiser',
    compatible: '✓ Compatible',
    incompatible: '✗ Problèmes',
    totalLabel: 'Total estimé',
    allCompatible: '✓ Tous les composants sont compatibles',
    tdpInfo: (tdp: number, psu: number) => `TDP : ${tdp}W · PSU recommandé : ${psu}W`,
    // Table headers
    thComponent: 'Composant',
    thSelection: 'Sélection',
    thBestPrice: 'Meilleur prix',
    // Row actions
    removeTitle: 'Retirer',
  },

  // ── Component picker ──────────────────────────────────────────────────────
  picker: {
    searchPlaceholder: 'Rechercher…',
    noResults: 'Aucun résultat',
    inStock: 'Stock',
    outOfStock: 'Rupture',
    filterBrand: 'Marque',
    filterAllBrands: 'Toutes',
    filterSocket: 'Socket',
    filterAllSockets: 'Tous',
    filterRamType: 'Type RAM',
    filterAllRam: 'DDR4+5',
    filterPrice: 'Prix (MAD)',
    filterPriceMin: 'Min',
    filterPriceMax: 'Max',
    filterClear: 'Effacer',
    sortLabel: 'Recommandé',
  },

  // ── Category browse page ──────────────────────────────────────────────────
  browse: {
    home: 'Accueil',
    components: 'Composants',
    searchPlaceholder: (cat: string) => `Rechercher ${cat}…`,
    filters: 'Filtres',
    inStockOnly: 'En stock',
    filterBrand: 'Marque',
    filterAllBrands: 'Toutes les marques',
    filterSocket: 'Socket',
    filterAllSockets: 'Tous les sockets',
    filterRamType: 'Type de RAM',
    filterAllRam: 'DDR4 + DDR5',
    filterPrice: 'Prix (MAD)',
    filterPriceMin: 'Min',
    filterPriceMax: 'Max',
    clearFilters: 'Effacer les filtres',
    clearAll: 'Effacer la recherche et les filtres',
    noResults: 'Aucun composant trouvé.',
    inBuildBadge: 'Dans la config',
    inStock: 'En stock',
    outOfStock: 'Rupture',
    noPrice: 'Prix non disponible',
    addToConfig: '+ Config',
    addedToConfig: '✓ Ajouté',
    unknownCategory: (cat: string) => `Catégorie inconnue : ${cat}`,
    back: '← Retour',
    paginationOf: (from: number, to: number, total: number) => `${from}–${to} sur ${total}`,
  },

  // ── Component detail page ─────────────────────────────────────────────────
  detail: {
    back: '← Retour',
    loading: 'Chargement…',
    notFound: 'Composant introuvable',
    backToConfigurator: '← Retour au configurateur',
    fromPrice: 'À partir de',
    inStock: 'En stock',
    addToConfig: 'Ajouter à la config',
    added: '✓ Ajouté',
    compare: 'Comparer',
    inCompare: 'Dans la comparaison',
    specs: 'Spécifications',
    prices: 'Prix actuels',
    noRetailer: "Ce composant n'est disponible chez aucun revendeur référencé.",
    priceHistory: 'Historique des prix',
    retailer: 'Revendeur',
    variant: 'Variante',
    price: 'Prix',
    stock: 'Stock',
    updated: 'Mis à jour',
    inStockBadge: 'En stock',
    outOfStock: 'Rupture',
    someOutOfStock: 'Certaines variantes affichées sont actuellement épuisées.',
    specYes: 'Oui',
    specNo: 'Non',
  },

  // ── Components index page ─────────────────────────────────────────────────
  componentsIndex: {
    title: 'Catalogue de composants',
    subtitle: 'Parcourez notre catalogue de composants PC avec comparaison de prix en temps réel.',
    count: (n: number) => `${n} composant${n !== 1 ? 's' : ''}`,
  },

  // ── Compare page ──────────────────────────────────────────────────────────
  compare: {
    back: '← Retour',
    title: 'Comparaison technique',
    subtitle: (max: number) => `Analysez jusqu'à ${max} composants côte à côte pour faire le meilleur choix.`,
    duelTitle: 'Analyse comparative',
    noData: 'Données de performance insuffisantes pour une analyse détaillée.',
    duelWinner: (winner: string, diff: string, loser: string) =>
      `${winner} offre ${diff}% de performances supplémentaires par rapport à ${loser}`,
    specLabel: 'Caractéristique',
    sectionPrice: 'Tarification et Offres',
    sectionPerf: 'Analyse des Performances',
    sectionSpecs: 'Fiche Technique',
    bestPrice: 'Meilleur prix',
    offers: 'Offres disponibles',
    perfPerPrice: 'Rapport Performance/Prix',
    perfPerPriceUnit: 'pts / MAD',
    perfPerPriceHint: "Un score plus élevé indique un meilleur investissement",
    removeTitle: 'Retirer de la sélection',
    addComponent: 'Ajouter un composant',
    add: 'Ajouter',
    browse: 'Parcourir le catalogue',
    emptyTitle: 'Aucun composant sélectionné',
    emptyText: 'Sélectionnez des composants dans le catalogue pour comparer leurs spécifications techniques et leurs prix.',
    browseCatalog: 'Consulter le catalogue',
    specYes: 'Oui',
    specNo: 'Non',
  },

  // ── Global search page ────────────────────────────────────────────────────
  search: {
    placeholder: 'Rechercher un composant… (ex: RTX 4090, Ryzen 7, DDR5)',
    searching: 'Recherche…',
    results: (n: number, q: string) =>
      `${n} résultat${n > 1 ? 's' : ''} pour « ${q} »`,
    noResults: (q: string) => `Aucun résultat pour « ${q} »`,
    groupCount: (n: number) => `${n} résultat${n > 1 ? 's' : ''}`,
    seeAll: 'Voir tout →',
    emptyTitle: (q: string) => `Aucun résultat pour « ${q} »`,
    emptyHint: "Essayez un terme plus court ou vérifiez l'orthographe.",
    suggestions: 'Suggestions :',
    browseBy: 'Parcourez par catégorie :',
  },

  // ── Market trends page ────────────────────────────────────────────────────
  trends: {
    title: 'Analyse du Marché',
    subtitle: 'Suivez les variations de prix en temps réel pour optimiser votre achat.',
    drops: 'Opportunités (Prix en baisse)',
    hikes: 'Variations (Prix en hausse)',
    period: 'Période d\'analyse',
    category: 'Secteur',
    allCategories: 'Toutes les catégories',
    dayUnit: (d: number) => `${d} derniers jours`,
    resultCount: (n: number, days: number) =>
      `${n} variation${n > 1 ? 's' : ''} notable${n > 1 ? 's' : ''} sur les ${days} derniers jours`,
    noResults: (days: number) =>
      `Aucune variation de prix significative n'a été détectée au cours des ${days} derniers jours.`,
    retry: 'Actualiser les données',
    savings: 'Économie potentielle',
    hike: 'Augmentation',
    viewDetails: 'Fiche produit',
  },

  // ── Presets page ──────────────────────────────────────────────────────────
  presets: {
    back: '← Retour au configurateur',
    title: "Configurations prêtes à l'emploi",
    subtitle: 'Choisissez une configuration adaptée à votre usage et chargez-la en un clic.',
    incomplete: 'Incomplet',
    incompleteTitle: "Certains composants ne sont plus disponibles",
    load: 'Charger cette configuration',
    empty: 'Aucune configuration disponible pour le moment.',
    useCases: {
      gaming: 'Gaming',
      workstation: 'Workstation',
      office: 'Bureau',
      budget: 'Budget',
    } as Record<string, string>,
  },

  // ── Price comparison component ────────────────────────────────────────────
  priceComparison: {
    title: 'Comparaison des prix',
    selectPrompt: 'Sélectionnez un composant pour comparer les prix.',
    noRetailer: "Ce composant n'est disponible chez aucun revendeur référencé.",
    retailer: 'Revendeur',
    variant: 'Variante',
    price: 'Prix',
    stock: 'Stock',
    updated: 'Mis à jour',
    inStock: 'En stock',
    outOfStock: 'Épuisé',
    buy: 'Voir →',
    someOutOfStock: 'Certaines variantes affichées sont actuellement épuisées.',
    error: (msg: string) => `Erreur : ${msg}`,
    showOos: (n: number) => `Voir ${n} offre${n > 1 ? 's' : ''} épuisée${n > 1 ? 's' : ''}`,
    hideOos: 'Masquer les épuisés',
  },

  // ── Inline prices component ───────────────────────────────────────────────
  inlinePrices: {
    loading: 'Chargement des prix…',
    empty: 'Aucun prix disponible.',
    offerCount: (n: number) => `${n} offre${n > 1 ? 's' : ''}`,
    inStock: 'En stock',
    outOfStock: 'Épuisé',
    buy: 'Acheter →',
  },

  // ── Price history chart ───────────────────────────────────────────────────
  priceHistory: {
    noData: "L'historique des prix n'est pas encore disponible pour ce composant.",
    madUnit: (v: number) => `${v} MAD`,
    title: 'Historique des prix',
    period7d: '7 jours',
    period30d: '30 jours',
    period1y: '1 an',
  },

  // ── Compare tray ──────────────────────────────────────────────────────────
  compareTray: {
    title: (n: number) => `Comparaison (${n})`,
    clearTitle: 'Tout effacer',
    removeTitle: 'Retirer',
    compareNow: 'Comparer maintenant',
  },

  // ── Error boundary ────────────────────────────────────────────────────────
  errorBoundary: {
    title: "Une erreur inattendue s'est produite",
    message: 'Quelque chose s\'est mal passé. Essayez de recharger la page.',
    reload: 'Recharger la page',
    technicalDetails: 'Détails techniques',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    tagline: 'PC Builder Maroc — comparateur de prix, pas un vendeur.',
    search: 'Recherche',
    compare: 'Comparer',
    trends: 'Tendances',
  },
} as const;
