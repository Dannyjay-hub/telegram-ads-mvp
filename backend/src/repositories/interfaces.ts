import { Deal, DealStatus, Channel, User, PublicBrief } from '../domain/entities';

export interface IDealRepository {
    create(deal: Partial<Deal>, briefId?: string): Promise<Deal>; // Updated signature
    findById(id: string): Promise<Deal | null>;
    findByChannelId(channelId: string): Promise<Deal[]>;
    findAll(): Promise<Deal[]>;
    updateStatus(id: string, status: DealStatus, reason?: string): Promise<Deal>;
}

export interface IChannelRepository {
    create(channel: Partial<Channel>): Promise<Channel>;
    findByTelegramId(telegramId: number): Promise<Channel | null>;
    findById(id: string): Promise<Channel | null>;
    findAll(filters?: { minSubscribers?: number, maxPrice?: number }): Promise<Channel[]>; // Added filters
    saveAdmins(channelId: string, admins: any[]): Promise<void>;
    findByAdminTelegramId(telegramId: number): Promise<Channel[]>;
    update(id: string, updates: Partial<Channel> | any): Promise<Channel>;
}

export interface IUserRepository {
    findByTelegramId(telegramId: number): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(user: Partial<User>): Promise<User>;
    update(id: string, user: Partial<User>): Promise<User>;
}

export interface IBriefRepository {
    create(brief: Partial<PublicBrief>): Promise<PublicBrief>;
    findAll(activeOnly?: boolean, filters?: { minBudget?: number, tag?: string }): Promise<PublicBrief[]>;
    findById(id: string): Promise<PublicBrief | null>;
}
