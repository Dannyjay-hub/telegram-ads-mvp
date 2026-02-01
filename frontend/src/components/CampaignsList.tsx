
import { GlassCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Construction } from 'lucide-react'

export function CampaignsList() {
    return (
        <div className="space-y-6">
            {/* Back navigation handled by Telegram native BackButton */}
            <GlassCard>
                <CardHeader>
                    <CardTitle>Your Campaigns</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-10">
                    <Construction className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">Campaign tracking is coming soon!</p>
                </CardContent>
            </GlassCard>
        </div>
    )
}
