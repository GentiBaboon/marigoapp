'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Bookmark, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SearchPage() {
    const recentSearches = [
        {
            id: 1,
            query: 'Women - Chanel Timeless',
            newCount: 99,
        }
    ];

    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="flex items-center p-2 md:p-4 border-b">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Search for items, members..." 
                        className="pl-11 h-11 rounded-full text-base"
                        autoFocus
                    />
                </div>
                <Button variant="ghost" asChild className="ml-2">
                    <Link href="/home">Close</Link>
                </Button>
            </header>
            
            <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-none bg-background border-b h-12">
                    <TabsTrigger value="items" className="text-base h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Items</TabsTrigger>
                    <TabsTrigger value="members" className="text-base h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Members</TabsTrigger>
                </TabsList>
                <TabsContent value="items" className="p-4 space-y-6">
                     <div className="flex justify-between items-center">
                        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recent Searches</h2>
                        <Button variant="ghost" className="h-auto p-0 text-sm text-muted-foreground">Edit</Button>
                    </div>
                    <ul className="space-y-4">
                        {recentSearches.map(search => (
                             <li key={search.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                   <p className="font-medium text-base">{search.query}</p>
                                   {search.newCount > 0 && (
                                       <Badge variant="destructive" className="rounded-sm font-bold">
                                        {`+${search.newCount} NEW`}
                                       </Badge>
                                   )}
                                </div>
                                <Button variant="ghost" size="icon" className="text-muted-foreground">
                                    <Bookmark className="h-5 w-5" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </TabsContent>
                <TabsContent value="members" className="p-4 text-center text-muted-foreground">
                    <p>Search for members by username.</p>
                </TabsContent>
            </Tabs>
        </div>
    );
}
