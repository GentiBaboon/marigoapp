'use client';
import { cn } from '@/lib/utils';
import type { FirestoreDelivery } from '@/lib/types';
import { format } from 'date-fns';

const TimelineDot = ({ state }: { state: 'completed' | 'current' | 'upcoming' }) => {
    return (
        <div className={cn("absolute left-0 top-1 h-4 w-4 rounded-full bg-background flex items-center justify-center -translate-x-[calc(50%-1px)]", {
            "z-10": state === 'current'
        })}>
            <div className={cn('h-full w-full rounded-full', {
                'bg-green-500': state === 'completed',
                'bg-blue-500 ring-4 ring-blue-200': state === 'current',
                'border-2 border-gray-300 bg-background': state === 'upcoming'
            })} />
        </div>
    )
}

interface TrackingTimelineProps {
    delivery: FirestoreDelivery;
}

export function TrackingTimeline({ delivery }: TrackingTimelineProps) {
    const { status, history } = delivery;

    const findHistoryEntry = (status: string) => history?.find(h => h.status === status);

    const steps = [
        { key: 'assigned', label: 'Courier Assigned' },
        { key: 'picked_up', label: 'Item Picked Up' },
        { key: 'in_transit', label: 'In Transit' },
        { key: 'delivered', label: 'Delivered' }
    ];

    const currentStepIndex = steps.findIndex(step => status.startsWith(step.key));

    return (
        <div className="relative ml-2">
            {/* Vertical line */}
            <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />
            
            {steps.map((step, index) => {
                const historyEntry = findHistoryEntry(step.key);
                const isCompleted = currentStepIndex > index;
                const isCurrent = currentStepIndex === index;
                const state = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming';

                return (
                    <div key={step.key} className="relative pl-8 pb-8 last:pb-0">
                        <TimelineDot state={state} />
                        <h4 className={cn("font-semibold", state === 'upcoming' && 'text-muted-foreground')}>
                            {step.label}
                        </h4>
                        {historyEntry && (
                            <p className="text-sm text-muted-foreground">
                                {format(new Date(historyEntry.timestamp.seconds * 1000), 'MMM d, yyyy, HH:mm')}
                            </p>
                        )}
                        {isCurrent && (
                            <p className="text-sm text-blue-600 font-medium animate-pulse">
                                {status === 'arrived_for_pickup' && 'Courier has arrived for pickup'}
                                {status === 'arrived_for_delivery' && 'Courier has arrived at destination'}
                            </p>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
