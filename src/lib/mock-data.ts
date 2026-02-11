import type { ImagePlaceholder } from './placeholder-images';

export type Product = {
  id: string;
  brand: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: ImagePlaceholder['id'];
  condition?: 'new' | 'like_new' | 'good' | 'fair';
  size?: string;
  color?: string;
};

export type SimilarSoldItem = {
    id: string;
    brand: string;
    title: string;
    price: number;
    image: ImagePlaceholder['id'];
    soldDate: string;
}

export type CartProduct = Product & {
  selectedSize: string;
  quantity: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

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
    id: '1',
    brand: 'Chanel',
    title: 'Classic Flap Bag',
    price: 8200,
    originalPrice: 9000,
    image: 'product-1',
  },
  {
    id: '2',
    brand: 'Gucci',
    title: 'Horsebit 1955 Shoulder Bag',
    price: 2500,
    image: 'product-2',
  },
  {
    id: '3',
    brand: 'Prada',
    title: 'Re-Nylon Bucket Hat',
    price: 550,
    image: 'product-3',
  },
  {
    id: '4',
    brand: 'Dior',
    title: "J'Adior Slingback Pump",
    price: 990,
    originalPrice: 1100,
    image: 'product-4',
  },
];

export const trendingProducts: Product[] = [
  {
    id: '5',
    brand: 'Louis Vuitton',
    title: 'Neverfull MM',
    price: 1800,
    image: 'product-5',
  },
  { id: '6', brand: 'Hermès', title: 'Oran Sandal', price: 660, image: 'product-6' },
  {
    id: '7',
    brand: 'Bottega Veneta',
    title: 'Mini Jodie',
    price: 2100,
    originalPrice: 2500,
    image: 'product-7',
  },
  {
    id: '8',
    brand: 'Saint Laurent',
    title: 'Kate Chain Wallet',
    price: 1550,
    image: 'product-8',
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
  },
  {
    id: '7',
    brand: 'Bottega Veneta',
    title: 'Mini Jodie',
    price: 1800,
    originalPrice: 2500,
    image: 'product-7',
  },
  {
    id: '1',
    brand: 'Chanel',
    title: 'Classic Flap Bag',
    price: 7000,
    originalPrice: 9000,
    image: 'product-1',
  },
  {
    id: '5',
    brand: 'Louis Vuitton',
    title: 'Neverfull MM',
    price: 1500,
    originalPrice: 1900,
    image: 'product-5',
  },
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
