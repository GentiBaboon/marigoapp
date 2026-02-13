import type { ImagePlaceholder } from './placeholder-images';
import { FirestoreConversation, FirestoreMessage } from './types';

export type Product = {
  id: string;
  brand: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: ImagePlaceholder['id'];
  sellerId: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair';
  size?: string;
  color?: string;
  sellerLocation?: string;
};

export type SimilarSoldItem = {
    id: string;
    brand: string;
    title: string;
    price: number;
    image: ImagePlaceholder['id'];
    soldDate: string;
}

export type Seller = {
  id: string;
  username: string;
  avatar: string;
};

export const sellers: Seller[] = [
    { id: 'seller-1', username: 'smoke_laughter_gigi', avatar: 'https://picsum.photos/seed/seller1/40/40' },
    { id: 'seller-2', username: 'bertolino34307352', avatar: 'https://picsum.photos/seed/seller2/40/40' },
    { id: 'seller-3', username: 'fashion_maven', avatar: 'https://picsum.photos/seed/seller3/40/40' },
    { id: 'seller-4', username: 'vintage_vibes', avatar: 'https://picsum.photos/seed/seller4/40/40' },
    { id: 'seller-5', username: 'luxe_resale', avatar: 'https://picsum.photos/seed/seller5/40/40' },
    { id: 'seller-6', username: 'style_cycler', avatar: 'https://picsum.photos/seed/seller6/40/40' },
    { id: 'seller-7', username: 'closet_curator', avatar: 'https://picsum.photos/seed/seller7/40/40' },
    { id: 'seller-8', username: 'designer_deals', avatar: 'https://picsum.photos/seed/seller8/40/40' },
    { id: 'seller-9', username: 'secondhand_chic', avatar: 'https://picsum.photos/seed/seller9/40/40' },
    { id: 'seller-10', username: 'preloved_luxe', avatar: 'https://picsum.photos/seed/seller10/40/40' },
    { id: 'seller-11', username: 'trend_reviver', avatar: 'https://picsum.photos/seed/seller11/40/40' },
    { id: 'seller-12', username: 'archive_fashion', avatar: 'https://picsum.photos/seed/seller12/40/40' },
    { id: 'seller-13', username: 'gentis_closet', avatar: 'https://picsum.photos/seed/seller13/40/40' },
];


export type CartProduct = Product & {
  selectedSize: string;
  quantity: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export const shopByCategory = [
  { id: '1', name: 'Clothing', slug: 'clothing', image: 'category-clothing' },
  { id: '2', name: 'Shoes', slug: 'shoes', image: 'category-shoes' },
  { id: '3', name: 'Watches', slug: 'watches', image: 'category-watch' },
  { id: '4', name: 'Accessories', slug: 'accessories', image: 'category-accessories' },
];

export const categories: Category[] = [
  { id: '1', name: 'Women', slug: 'women' },
  { id: '2', name: 'Men', slug: 'men' },
  { id: '3', name: 'Children', slug: 'children' },
  { id: '4', name: 'Bags', slug: 'bags' },
  { id: '5', name: 'Shoes', slug: 'shoes' },
  { id: '6', name: 'Accessories', slug: 'accessories' },
  { id: '7', name: 'Beauty', slug: 'beauty' },
  { id: '8', name: 'Home', slug: 'home' },
  { id: '9', name: 'Art', slug: 'art' },
];

export type ProductCategory = {
  name: string;
  subcategories: {
    name: string;
    slug: string;
  }[];
};

export const productCategories: ProductCategory[] = [
    {
        name: 'Bags',
        subcategories: [
            { name: 'Handbags', slug: 'handbags' },
            { name: 'Clutch bags', slug: 'clutch-bags' },
            { name: 'Backpacks', slug: 'backpacks' },
            { name: 'Travel bags', slug: 'travel-bags' }
        ]
    },
    {
        name: 'Shoes',
        subcategories: [
            { name: 'Boots', slug: 'boots' },
            { name: 'Trainers', slug: 'trainers' },
            { name: 'Flats', slug: 'flats' },
            { name: 'Ballet flats', slug: 'ballet-flats' },
            { name: 'Sandals', slug: 'sandals' },
            { name: 'Mules & Clogs', slug: 'mules-clogs' },
            { name: 'Lace ups', slug: 'lace-ups' },
            { name: 'Heels', slug: 'heels' },
            { name: 'Ankle boots', slug: 'ankle-boots' },
            { name: 'Espadrilles', slug: 'espadrilles' }
        ]
    },
    {
        name: 'Clothing',
        subcategories: [
            { name: 'Knitwear', slug: 'knitwear' },
            { name: 'Tops', slug: 'tops' },
            { name: 'Dresses', slug: 'dresses' },
            { name: 'Skirts', slug: 'skirts' },
            { name: 'Trousers', slug: 'trousers' },
            { name: 'Shorts', slug: 'shorts' },
            { name: 'Jumpsuits', slug: 'jumpsuits' },
            { name: 'Jeans', slug: 'jeans' },
            { name: 'Jackets', slug: 'jackets' },
            { name: 'Coats', slug: 'coats' },
            { name: 'Leather jackets', slug: 'leather-jackets' },
            { name: 'Trench coats', slug: 'trench-coats' },
            { name: 'Lingerie', slug: 'lingerie' },
            { name: 'Swimwear', slug: 'swimwear' }
        ]
    },
    {
        name: 'Accessories',
        subcategories: [
            { name: 'Sunglasses', slug: 'sunglasses' },
            { name: 'Wallets', slug: 'wallets' },
            { name: 'Belts', slug: 'belts' },
            { name: 'Silk handkerchief', slug: 'silk-handkerchief' },
            { name: 'Hats', slug: 'hats' },
            { name: 'Scarves', slug: 'scarves' },
            { name: 'Purses, wallets & cases', slug: 'purses-wallets-cases' },
            { name: 'Watches', slug: 'watches' },
            { name: 'Gloves', slug: 'gloves' }
        ]
    }
];

export const brands = [
    { name: 'Chanel', slug: 'chanel' },
    { name: 'Gucci', slug: 'gucci' },
    { name: 'Prada', slug: 'prada' },
    { name: 'Dior', slug: 'dior' },
    { name: 'Louis Vuitton', slug: 'louis-vuitton' },
    { name: 'Hermès', slug: 'hermes' },
    { name: 'Bottega Veneta', slug: 'bottega-veneta' },
    { name: 'Saint Laurent', slug: 'saint-laurent' },
    { name: 'Fendi', slug: 'fendi' },
    { name: 'Celine', slug: 'celine' },
    { name: 'Lacoste', slug: 'lacoste' },
    { name: 'VETEMENTS', slug: 'vetements' },
    { name: 'LORO PIANA', slug: 'loro-piana' },
    { name: 'Balenciaga', slug: 'balenciaga' },
    { name: 'Rolex', slug: 'rolex' },
    { name: 'Burberry', slug: 'burberry' },
    { name: 'Tom Ford', slug: 'tom-ford' },
    { name: 'Max Mara', slug: 'max-mara' },
    { name: 'Zimmermann', slug: 'zimmermann' },
    { name: 'Acne Studios', slug: 'acne-studios' },
    { name: 'MAISON MARTIN MARGIELA', slug: 'maison-martin-margiela'},
    { name: 'ZEGNA', slug: 'zegna' },
];

export const productConditions = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
]

export const productSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const productColors = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Gray', hex: '#808080' },
    { name: 'Red', hex: '#FF0000' },
    { name: 'Blue', hex: '#0000FF' },
    { name: 'Green', hex: '#008000' },
    { name: 'Yellow', hex: '#FFFF00' },
    { name: 'Brown', hex: '#A52A2A' },
    { name: 'Beige', hex: '#F5F5DC' },
    { name: 'Pink', hex: '#FFC0CB' },
    { name: 'Purple', hex: '#800080' },
    { name: 'Orange', hex: '#FFA500' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Multi-color', hex: '#FFFFFF' },
];

export const productMaterials = ['Leather', 'Cotton', 'Denim', 'Silk', 'Wool', 'Cashmere', 'Suede', 'Linen', 'Velvet', 'Fur', 'Synthetic', 'Nylon', 'Polyester'];

export const productPatterns = ['Plain', 'Striped', 'Checked', 'Dotted', 'Floral', 'Animal Print', 'Geometric', 'Paisley', 'Houndstooth', 'Plaid'];

export const sizeStandards = [
    { value: 'eu', label: 'EU' },
    { value: 'uk', label: 'UK' },
    { value: 'us', label: 'US' },
    { value: 'it', label: 'IT' },
    { value: 'kr', label: 'KR' },
];

export const shoeSizes = {
    eu: Array.from({length: 12}, (_, i) => String(35 + i)), // 35-46
    uk: Array.from({length: 12}, (_, i) => String(2 + i)), // 2-13
    us: Array.from({length: 12}, (_, i) => String(4 + i)), // 4-15
    it: Array.from({length: 12}, (_, i) => String(35 + i)), // 35-46
    kr: Array.from({length: 9}, (_, i) => String(220 + i*10)), // 220-300
};

export const clothingSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];


export const newArrivals: Product[] = [
  {
    id: '9',
    brand: 'Saint Laurent',
    title: 'Leather Biker Jacket',
    price: 3200,
    image: 'product-9',
    sellerId: 'seller-4',
    size: 'M',
    sellerLocation: 'France'
  },
  {
    id: '10',
    brand: 'Balenciaga',
    title: 'Triple S Trainers',
    price: 750,
    image: 'product-10',
    sellerId: 'seller-5',
    size: '42 EU',
    sellerLocation: 'Spain'
  },
  {
    id: '11',
    brand: 'Rolex',
    title: 'Submariner Watch',
    price: 12500,
    image: 'product-11',
    sellerId: 'seller-6',
    size: '41mm',
    sellerLocation: 'Switzerland'
  },
  {
    id: '12',
    brand: 'Burberry',
    title: 'Classic Check Scarf',
    price: 350,
    image: 'product-12',
    sellerId: 'seller-7',
    size: 'One Size',
    sellerLocation: 'United Kingdom'
  },
  {
    id: '13',
    brand: 'Tom Ford',
    title: 'Snowdon Sunglasses',
    price: 280,
    image: 'product-13',
    sellerId: 'seller-8',
    size: 'One Size',
    sellerLocation: 'USA'
  },
  {
    id: '14',
    brand: 'Max Mara',
    title: 'Manuela Wool Coat',
    price: 1500,
    image: 'product-14',
    sellerId: 'seller-9',
    size: 'L',
    sellerLocation: 'Italy'
  },
  {
    id: '15',
    brand: 'Zimmermann',
    title: 'Postcard Silk Dress',
    price: 650,
    image: 'product-15',
    sellerId: 'seller-10',
    size: 'S',
    sellerLocation: 'Australia'
  },
  {
    id: '16',
    brand: 'Celine',
    title: 'Trio Crossbody Bag',
    price: 980,
    image: 'product-16',
    sellerId: 'seller-11',
    size: 'Small',
    sellerLocation: 'France'
  },
  {
    id: '17',
    brand: 'Gucci',
    title: 'GG Marmont Belt',
    price: 420,
    image: 'product-17',
    sellerId: 'seller-12',
    size: '85',
    sellerLocation: 'Italy'
  },
  {
    id: '18',
    brand: 'Acne Studios',
    title: '1996 Denim Jeans',
    price: 250,
    image: 'product-18',
    sellerId: 'seller-13',
    size: '32/32',
    sellerLocation: 'Sweden'
  },
  {
    id: '1',
    brand: 'Chanel',
    title: 'Classic Flap Bag',
    price: 8200,
    originalPrice: 9000,
    image: 'product-1',
    sellerId: 'seller-1',
    size: 'Medium',
    sellerLocation: 'France'
  },
  {
    id: '2',
    brand: 'Gucci',
    title: 'Horsebit 1955 Shoulder Bag',
    price: 2500,
    image: 'product-2',
    sellerId: 'seller-2',
    size: 'Medium',
    sellerLocation: 'Italy'
  },
  {
    id: '3',
    brand: 'Prada',
    title: 'Re-Nylon Bucket Hat',
    price: 550,
    image: 'product-3',
    sellerId: 'seller-1',
    size: 'M',
    sellerLocation: 'Italy'
  },
  {
    id: '4',
    brand: 'Dior',
    title: "J'Adior Slingback Pump",
    price: 990,
    originalPrice: 1100,
    image: 'product-4',
    sellerId: 'seller-3',
    size: '38 IT',
    sellerLocation: 'France'
  },
];

export const trendingProducts: Product[] = [
  {
    id: 'vetements-1',
    brand: 'VETEMENTS',
    title: 'Sweatshirt',
    price: 489,
    originalPrice: 511,
    image: 'trending-vetements',
    sellerId: 'seller-1',
    size: 'XS International',
    sellerLocation: 'Italy'
  },
  {
    id: 'margiela-1',
    brand: 'MAISON MARTIN MARGIELA',
    title: 'Pull',
    price: 101,
    image: 'trending-margiela',
    sellerId: 'seller-2',
    size: 'S International',
    sellerLocation: 'Italy'
  },
  {
    id: 'zegna-1',
    brand: 'ZEGNA',
    title: 'Wool jacket',
    price: 3300,
    image: 'trending-zegna',
    sellerId: 'seller-3',
    size: '48 IT',
    sellerLocation: 'Greece'
  },
  {
    id: '8',
    brand: 'Saint Laurent',
    title: 'Kate Chain Wallet',
    price: 1550,
    image: 'product-8',
    sellerId: 'seller-2',
    size: 'Small',
    sellerLocation: 'France'
  },
];

export const outletProducts: Product[] = [
  {
    id: '4',
    brand: 'Dior',
    title: "J'Adior Slingback Pump",
    price: 750,
    originalPrice: 1100,
    image: 'product-4',
    sellerId: 'seller-3',
    size: '38 IT',
    sellerLocation: 'France'
  },
  {
    id: '7',
    brand: 'Bottega Veneta',
    title: 'Mini Jodie',
    price: 1800,
    originalPrice: 2500,
    image: 'product-7',
    sellerId: 'seller-1',
    size: 'Mini',
    sellerLocation: 'Italy'
  },
  {
    id: '1',
    brand: 'Chanel',
    title: 'Classic Flap Bag',
    price: 7000,
    originalPrice: 9000,
    image: 'product-1',
    sellerId: 'seller-1',
    size: 'Medium',
    sellerLocation: 'France'
  },
  {
    id: '5',
    brand: 'Louis Vuitton',
    title: 'Neverfull MM',
    price: 1500,
    originalPrice: 1900,
    image: 'product-5',
    sellerId: 'seller-2',
    size: 'MM',
    sellerLocation: 'France'
  },
];

export const recentlyViewedProducts: Product[] = [
  {
    id: 'loro-piana-1',
    brand: 'LORO PIANA',
    title: 'Cashmere coat',
    price: 2800,
    image: 'loro-piana-coat',
    sellerId: 'seller-1',
    size: 'M International',
    sellerLocation: 'France',
  },
  {
    id: 'vetements-1',
    brand: 'VETEMENTS',
    title: 'Sweatshirt',
    price: 489,
    originalPrice: 511,
    image: 'trending-vetements', // Reusing this image id
    sellerId: 'seller-2',
    size: 'XS International',
    sellerLocation: 'Italy',
  },
  {
    id: 'burberry-1',
    brand: 'BURBERRY',
    title: 'Leather boots',
    price: 294,
    image: 'burberry-boots',
    sellerId: 'seller-3',
    size: '42 EU',
    sellerLocation: 'Spain',
  },
];

export const vintageGems = [
  { id: '1', name: 'JACKETS', slug: 'jackets', image: 'vintage-jacket' },
  { id: '2', name: 'JEWELLERY', slug: 'jewellery', image: 'vintage-jewellery' },
  { id: '3', name: 'KNITWEAR', slug: 'knitwear', image: 'vintage-knitwear' },
];

export const cartItems: CartProduct[] = [
  {
    id: '1',
    brand: 'Chanel',
    title: 'Classic Flap Bag',
    price: 8200,
    originalPrice: 9000,
    image: 'product-1',
    selectedSize: 'Medium',
    quantity: 1,
    sellerId: 'seller-1'
  },
  {
    id: '4',
    brand: 'Dior',
    title: "J'Adior Slingback Pump",
    price: 990,
    originalPrice: 1100,
    image: 'product-4',
    selectedSize: '38',
    quantity: 1,
    sellerId: 'seller-3'
  },
  {
    id: '7',
    brand: 'Bottega Veneta',
    title: 'Mini Jodie',
    price: 2100,
    originalPrice: 2500,
    image: 'product-7',
    selectedSize: 'Mini',
    quantity: 1,
    sellerId: 'seller-1'
  },
];

export const savedAddresses = [
  {
    id: 'addr-1',
    fullName: 'Jane Doe',
    address: 'Rruga e Kavajes, Nd 5, H 3',
    city: 'Tirana',
    postal: '1001',
    country: 'Albania',
    phone: '+355 69 123 4567',
    isDefault: true,
  },
  {
    id: 'addr-2',
    fullName: 'John Doe',
    address: 'Via del Corso 10',
    city: 'Rome',
    postal: '00186',
    country: 'Italy',
    phone: '+39 06 1234567',
    isDefault: false,
  },
];

export const similarSoldItems: SimilarSoldItem[] = [
    { id: 'similar-1', brand: 'Lacoste', title: 'Cashmere handbag', price: 32, image: 'similar-1', soldDate: 'Sold 2 years ago' },
    { id: 'similar-2', brand: 'Lacoste', title: 'Cashmere handbag', price: 29, image: 'similar-2', soldDate: 'Sold 2 years ago' },
    { id: 'similar-3', brand: 'Lacoste', title: 'Handbag', price: 26, image: 'similar-3', soldDate: 'Sold last year' },
];

export const mockConversations = [
    {
        id: 'convo-1',
        participants: ['user-A', 'seller-1'],
        participantDetails: [
            { userId: 'user-A', name: 'You', avatar: 'https://picsum.photos/seed/userA/100/100' },
            { userId: 'seller-1', name: 'Luxury Finds', avatar: 'https://picsum.photos/seed/seller1/100/100' },
        ],
        productId: '1',
        productTitle: 'Classic Flap Bag',
        productImage: 'product-1',
        lastMessage: 'Is this still available?',
        lastMessageAt: { seconds: Date.now() / 1000 - 3600, nanoseconds: 0 },
        unreadCount: { 'user-A': 0, 'seller-1': 1 }
    },
    {
        id: 'convo-2',
        participants: ['user-A', 'seller-2'],
        participantDetails: [
            { userId: 'user-A', name: 'You', avatar: 'https://picsum.photos/seed/userA/100/100' },
            { userId: 'seller-2', name: 'Bertolino', avatar: 'https://picsum.photos/seed/seller2/100/100' },
        ],
        productId: '5',
        productTitle: 'Neverfull MM',
        productImage: 'product-5',
        lastMessage: 'Ok, thank you!',
        lastMessageAt: { seconds: Date.now() / 1000 - 86400, nanoseconds: 0 },
        unreadCount: { 'user-A': 0, 'seller-2': 0 }
    }
] as FirestoreConversation[];

export const mockMessages = {
    'convo-1': [
        { id: 'msg-1', senderId: 'seller-1', content: 'Yes, it is!', createdAt: { seconds: Date.now() / 1000 - 3610, nanoseconds: 0 } },
        { id: 'msg-2', senderId: 'user-A', content: 'Is this still available?', createdAt: { seconds: Date.now() / 1000 - 3600, nanoseconds: 0 } },
    ],
    'convo-2': [
        { id: 'msg-3', senderId: 'seller-2', content: 'I can ship it tomorrow morning.', createdAt: { seconds: Date.now() / 1000 - 86410, nanoseconds: 0 } },
        { id: 'msg-4', senderId: 'user-A', content: 'Ok, thank you!', createdAt: { seconds: Date.now() / 1000 - 86400, nanoseconds: 0 } },
    ]
} as Record<string, FirestoreMessage[]>;


export const browseCategories = {
  women: [
    { name: "Women's Homepage", href: "/browse/women" },
    { name: "Bags", href: "/browse/women/bags" },
    { name: "Clothing", href: "/browse/women/clothing" },
    { name: "Shoes", href: "/browse/women/shoes" },
    { name: "Jewellery", href: "/browse/women/jewellery" },
    { name: "Watches", href: "/browse/women/watches" },
    { name: "Accessories", href: "/browse/women/accessories" },
  ],
  men: [
    { name: "Men's Homepage", href: "/browse/men" },
    { name: "Clothing", href: "/browse/men/clothing" },
    { name: "Shoes", href: "/browse/men/shoes" },
    { name: "Accessories", href: "/browse/men/accessories" },
    { name: "Watches", href: "/browse/men/watches" },
  ],
  children: [
    { name: "Children's Homepage", href: "/browse/children" },
    { name: "Girls", href: "/browse/children/girls" },
    { name: "Boys", href: "/browse/children/boys" },
    { name: "Baby", href: "/browse/children/baby" },
  ],
};

export const browseBanners = [
    { id: 'new-arrivals', title: 'New Arrivals for You', description: 'A daily drop, personalized for you', image: 'banner-new-arrivals', href: '/browse/new-arrivals' },
    { id: 'designers', title: 'Designers', description: 'A-Z of brands and official partners', image: 'banner-designers', href: '/browse/designers' },
    { id: 'we-love', title: 'We Love', description: '', image: 'banner-we-love', href: '/browse/we-love' }
];
    
