'use client';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '../ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  user: { userId: string; name: string; avatar?: string };
  product: { id: string; title: string; image: string };
  isTyping?: boolean;
}

export function ChatHeader({ user, product, isTyping }: ChatHeaderProps) {
  const productImage = PlaceHolderImages.find(p => p.id === product.image);
  const imageUrl = productImage?.imageUrl || product.image;

  return (
    <div className="flex items-center p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-10 gap-1">
      <Button asChild variant="ghost" size="icon" className="md:hidden flex-shrink-0">
        <Link href="/messages">
          <ChevronLeft className="h-6 w-6" />
        </Link>
      </Button>

      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={user.avatar} alt={user.name} />
        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 ml-2">
        <p className="font-semibold leading-tight">{user.name}</p>
        <p className={cn('text-xs transition-colors leading-tight', isTyping ? 'text-primary font-medium' : 'text-muted-foreground')}>
          {isTyping ? 'typing...' : `About: ${product.title}`}
        </p>
      </div>

      <Link href={`/products/${product.id}`} className="ml-auto flex-shrink-0">
        <div className="relative h-10 w-10 bg-muted rounded-lg overflow-hidden border">
          <Image src={imageUrl} alt={product.title} fill className="object-cover" sizes="40px" />
        </div>
      </Link>
    </div>
  );
}
