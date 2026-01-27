
import { useNavigate } from 'react-router-dom'
import { GlassCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Construction } from 'lucide-react'

export function CampaignsList() {
    const navigate = useNavigate()
    return (
        <div className="space-y-6">
            <Button variant="ghost" className="pl-0 gap-2" onClick={() => navigate((-1 as any))}>
                <ArrowLeft className="w-4 h-4" /> Back
            </Button>
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
