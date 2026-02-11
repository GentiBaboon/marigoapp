'use client';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '../ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface ChatHeaderProps {
    user: {
        userId: string;
        name: string;
        avatar?: string;
    };
    product: {
        id: string;
        title: string;
        image: string;
    }
}

export function ChatHeader({ user, product }: ChatHeaderProps) {

    const productImage = PlaceHolderImages.find((p) => p.id === product.image);
    const imageUrl = productImage?.imageUrl || product.image;

    return (
        <div className="flex items-center p-2 border-b">
             <Button asChild variant="ghost" size="icon" className="md:hidden">
                <Link href="/messages">
                    <ChevronLeft className="h-6 w-6" />
                </Link>
            </Button>
            <div className="flex items-center gap-3">
                 <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="grid gap-0.5">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">Replying about: {product.title}</p>
                </div>
            </div>
            <Link href={`/products/${product.id}`} className="ml-auto flex items-center gap-2">
                 <div className="relative h-10 w-10 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                    <Image src={imageUrl} alt={product.title} fill className="object-cover" sizes="40px" />
                </div>
            </Link>
        </div>
    )
}
