'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { SocialButtons } from '@/components/auth/social-buttons';
import { useUser } from '@/firebase';
import { useEffect } from 'react';

export default function AuthGatePage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const bgImage = PlaceHolderImages.find(p => p.id === 'home-hero');

    useEffect(() => {
        if (!isUserLoading && user) {
            router.replace('/home');
        }
    }, [user, isUserLoading, router]);


    if (isUserLoading || user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="dot-flashing"></div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full text-white bg-black">
            {bgImage && (
                 <Image
                    src={bgImage.imageUrl}
                    alt="Fashion models"
                    fill
                    className="object-cover opacity-50"
                    priority
                    data-ai-hint="luxury fashion"
                 />
            )}
            
            <div className="absolute inset-0 flex flex-col justify-end p-8 space-y-5">
                <div className="text-center mb-4">
                    <div className="flex justify-center mb-2">
                        <Image src="/logo.png" alt="Marigo" width={140} height={40} className="h-10 w-auto brightness-0 invert" />
                    </div>
                    <p className="mt-2 text-lg">Register today for a special discount off your first purchase.</p>
                </div>
                
                <SocialButtons variant="default" className="bg-white text-black hover:bg-gray-200" />
                
                <Button asChild variant="outline" className="w-full border-white text-white bg-transparent hover:bg-white hover:text-black">
                    <Link href="/auth/signup">
                        Register with Email
                    </Link>
                </Button>
                
                <div className="text-center text-sm">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="underline font-semibold">
                        Log in
                    </Link>
                </div>

                <div className="text-center">
                    <Button variant="link" className="text-white/80 hover:text-white" onClick={() => router.replace('/home')}>
                        Register later
                    </Button>
                </div>
            </div>
        </div>
    );
}
