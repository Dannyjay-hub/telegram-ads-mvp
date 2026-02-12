import { useState } from 'react';
import { GlassCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Zap } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { showAlert } from '@/lib/telegram';
import { TonIcon, UsdtIcon } from '@/components/icons/CurrencyIcons';

interface Package {
    id: string;
    title: string;
    description: string;
    price: number;
    type: 'post' | 'story' | 'repost' | 'custom';
    currency: 'TON' | 'USDT';
}

interface RateCardEditorProps {
    value: Package[];
    onChange: (packages: Package[]) => void;
}

export function RateCardEditor({ value = [], onChange }: RateCardEditorProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newPkg, setNewPkg] = useState<Partial<Package>>({
        type: 'post',
        title: '',
        price: undefined,
        description: '',
        currency: 'TON'
    });

    const handleAdd = () => {
        if (!newPkg.title || !newPkg.price) {
            showAlert('Title and Price are required');
            return;
        }

        const pkg: Package = {
            id: crypto.randomUUID(),
            title: newPkg.title,
            price: Number(newPkg.price),
            description: newPkg.description || '',
            type: newPkg.type || 'post',
            currency: newPkg.currency || 'TON'
        };

        onChange([...value, pkg]);
        setIsAdding(false);
        setNewPkg({ type: 'post', title: '', price: undefined, description: '', currency: 'TON' });
    };

    const handleRemove = (id: string) => {
        onChange(value.filter(p => p.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yello-400" /> Service Packages
                </Label>
                {!isAdding && (
                    <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} className="border-primary/20 text-primary">
                        <Plus className="w-4 h-4 mr-2" /> Add Package
                    </Button>
                )}
            </div>

            <div className="grid gap-3">
                {value.map((pkg) => (
                    <GlassCard key={pkg.id} className="p-4 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{pkg.title}</span>
                                <span className="text-xs px-2 py-0.5 rounded bg-white/10">{pkg.type.toUpperCase()}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{pkg.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-lg flex items-center gap-1.5">
                                {pkg.price}
                                {pkg.currency === 'USDT' ? (
                                    <><UsdtIcon className="w-4 h-4" /> <span className="text-sm">USDT</span></>
                                ) : (
                                    <><TonIcon className="w-4 h-4" /> <span className="text-sm">TON</span></>
                                )}
                            </span>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300" onClick={() => handleRemove(pkg.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </GlassCard>
                ))}
            </div>

            {isAdding && (
                <GlassCard className="p-4 space-y-3 bg-primary/5 border-primary/20">
                    <h4 className="font-bold text-sm">New Package</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <Label>Package Title</Label>
                            <Input
                                placeholder="e.g. 24h Pinned Post"
                                value={newPkg.title}
                                onChange={e => setNewPkg({ ...newPkg, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Price</Label>
                            <Input
                                type="number"
                                placeholder="100"
                                value={newPkg.price || ''}
                                onChange={e => setNewPkg({ ...newPkg, price: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label>Currency</Label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={newPkg.currency}
                                onChange={e => setNewPkg({ ...newPkg, currency: e.target.value as 'TON' | 'USDT' })}
                            >
                                <option value="TON">TON</option>
                                <option value="USDT">USDT</option>
                            </select>
                        </div>
                        <div>
                            <Label>Type</Label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={newPkg.type}
                                onChange={e => setNewPkg({ ...newPkg, type: e.target.value as any })}
                            >
                                <option value="post">Post</option>
                                <option value="story">Story</option>
                                <option value="repost">Repost</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <Label>Description</Label>
                            <Textarea
                                placeholder="What's included? (e.g. link in bio, 24h pin)"
                                value={newPkg.description}
                                onChange={e => setNewPkg({ ...newPkg, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleAdd}>Save Package</Button>
                    </div>
                </GlassCard>
            )}

            {value.length === 0 && !isAdding && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                    No packages defined. Advertisers won't be able to hire you.
                    <br />
                    <Button variant="ghost" onClick={() => setIsAdding(true)}>Create your first package</Button>
                </div>
            )}
        </div>
    );
}
