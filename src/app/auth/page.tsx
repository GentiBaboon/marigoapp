'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/logo';
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
            <div className="flex min-h-viewport-content w-full items-center justify-center bg-background">
                <div className="dot-flashing"></div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-viewport-content w-full flex-col justify-end overflow-hidden text-white bg-black">
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

            {/* Content sits in normal flow so it can grow past the panel on very
                short screens instead of being clipped by it. */}
            <div className="relative z-10 mx-auto w-full max-w-sm space-y-3 px-6 pb-6 pt-10">
                <div className="text-center">
                    <div className="flex justify-center">
                        <Logo size="lg" invert />
                    </div>
                    <p className="mt-2 text-base leading-snug">Register today for a special discount off your first purchase.</p>
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
                    <button
                        type="button"
                        className="text-sm text-white/80 underline-offset-4 hover:text-white hover:underline"
                        onClick={() => router.replace('/home')}
                    >
                        Register later
                    </button>
                </div>
            </div>
        </div>
    );
}
