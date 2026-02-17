'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courierApplicationSchema, type CourierApplicationValues } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const availabilityDays = [
    { id: 'monday', label: 'Monday' },
    { id: 'tuesday', label: 'Tuesday' },
    { id: 'wednesday', label: 'Wednesday' },
    { id: 'thursday', label: 'Thursday' },
    { id: 'friday', label: 'Friday' },
    { id: 'saturday', label: 'Saturday' },
    { id: 'sunday', label: 'Sunday' },
];

export function CourierApplicationForm() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<CourierApplicationValues>({
        resolver: zodResolver(courierApplicationSchema),
        defaultValues: {
            legalName: '',
            phone: '',
            vehicleType: undefined,
            licensePlate: '',
            serviceAreas: '',
            availability: [],
        },
    });

    const onSubmit = async (data: CourierApplicationValues) => {
        if (!user) {
            toast({ variant: 'destructive', title: "Not authenticated" });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Create the courier profile
            const courierProfileRef = doc(firestore, 'courier_profiles', user.uid);
            await setDoc(courierProfileRef, {
                userId: user.uid,
                ...data,
                dob: format(data.dob, 'yyyy-MM-dd'), // Store date as string
            });

            // 2. Update the user document to reflect courier status
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, {
                isCourier: true,
                courierStatus: 'pending_approval'
            });

            toast({
                title: 'Application Submitted!',
                description: "We'll review your application and get back to you soon.",
            });
            
            router.refresh();

        } catch (error: any) {
            console.error("Error submitting courier application:", error);
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: error.message || "Could not submit your application. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Legal Full Name</FormLabel>
                            <FormControl>
                                <Input placeholder="As it appears on your ID" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Date of birth</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                {field.value ? (
                                format(field.value, "PPP")
                                ) : (
                                <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                 <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                                <Input type="tel" placeholder="Your contact number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="vehicleType"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Vehicle Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your vehicle" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="bicycle">Bicycle</SelectItem>
                                    <SelectItem value="scooter">Scooter</SelectItem>
                                    <SelectItem value="car">Car</SelectItem>
                                    <SelectItem value="van">Van</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="licensePlate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>License Plate</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. AA 123 BB" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="serviceAreas"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Service Areas</FormLabel>
                            <FormDescription>
                                List the cities or postal codes you're willing to cover, separated by commas.
                            </FormDescription>
                            <FormControl>
                                <Input placeholder="e.g. Tirana, 1001, Durrës" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="availability"
                    render={() => (
                        <FormItem>
                            <div className="mb-4">
                                <FormLabel className="text-base">Availability</FormLabel>
                                <FormDescription>
                                Select the days you are generally available to make deliveries.
                                </FormDescription>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {availabilityDays.map((item) => (
                                <FormField
                                key={item.id}
                                control={form.control}
                                name="availability"
                                render={({ field }) => {
                                    return (
                                    <FormItem
                                        key={item.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(item.id)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...field.value, item.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                        (value) => value !== item.id
                                                    )
                                                )
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                        {item.label}
                                        </FormLabel>
                                    </FormItem>
                                    )
                                }}
                                />
                            ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Document Upload Section Placeholder */}
                <div>
                     <FormLabel>Documents</FormLabel>
                     <FormDescription>
                        You will be required to upload documents like ID, driver's license, etc. after your initial application is reviewed.
                     </FormDescription>
                     <div className="mt-4 p-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                        Document upload will be enabled soon.
                     </div>
                </div>


                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Application
                </Button>
            </form>
        </Form>
    );
}
