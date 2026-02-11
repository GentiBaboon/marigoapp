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
];

export const productMaterials = ['Leather', 'Cotton', 'Denim', 'Silk', 'Wool', 'Cashmere'];


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
