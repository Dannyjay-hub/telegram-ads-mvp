
import { GlassCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Handshake } from 'lucide-react'

export function PartnershipsList() {
    return (
        <div className="space-y-6">
            {/* Back navigation handled by Telegram native BackButton */}
            <GlassCard>
                <CardHeader>
                    <CardTitle>Active Partnerships</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-10">
                    <Handshake className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">Direct partnership management coming soon!</p>
                </CardContent>
            </GlassCard>
        </div>
    )
}
