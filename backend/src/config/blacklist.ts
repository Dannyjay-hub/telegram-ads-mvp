/**
 * Blacklisted Words Configuration
 * 
 * Content moderation to prevent illegal, harmful, or prohibited content.
 * Add new words to this list as needed.
 * 
 * NOTE: This list is server-side only. NEVER expose to frontend.
 */

export const BLACKLISTED_WORDS: string[] = [
    // ========== WEAPONS & VIOLENCE ==========
    'gun', 'guns', 'weapon', 'weapons', 'firearms', 'ammunition', 'ammo',
    'rifle', 'pistol', 'shotgun', 'handgun', 'revolver', 'ak47', 'ar15',
    'explosive', 'explosives', 'bomb', 'bombs', 'grenade', 'grenades',
    'missile', 'missiles', 'landmine', 'detonator',

    // ========== DRUGS & SUBSTANCES ==========
    'cocaine', 'heroin', 'meth', 'methamphetamine', 'fentanyl', 'crack',
    'ecstasy', 'mdma', 'lsd', 'ketamine', 'pcp', 'amphetamine',
    'opioid', 'opioids', 'morphine', 'xanax', 'percocet', 'oxycodone',
    'drug dealer', 'drug trafficking', 'buy drugs', 'sell drugs',
    'narcotics', 'dope', 'crystal meth',

    // ========== ADULT CONTENT ==========
    'porn', 'pornography', 'xxx', 'nsfw', 'nude', 'nudes', 'naked',
    'sex chat', 'sex work', 'escort', 'escorts', 'prostitution', 'prostitute',
    'adult content', 'explicit content', 'explicit material',
    'onlyfans leak', 'leaked nudes', 'hentai', 'camgirl', 'cam girl',
    'sugar daddy', 'sugar baby', 'hookup', 'hook up', 'erotic',

    // ========== CSAM / CHILD SAFETY (CRITICAL) ==========
    'child porn', 'childporn', 'cp', 'pedo', 'pedophile', 'pedophilia',
    'preteen', 'jailbait', 'loli', 'shota', 'minor nsfw', 'underage',

    // ========== TERRORISM & EXTREMISM ==========
    'terrorism', 'terrorist', 'terrorists', 'isis', 'al-qaeda', 'al qaeda',
    'jihad', 'jihadist', 'suicide bomber', 'mass shooting', 'school shooting',
    'white supremacy', 'white supremacist', 'neo-nazi', 'neonazi',

    // ========== VIOLENCE & HARM ==========
    'kill for hire', 'hitman', 'hit man', 'assassination', 'assassin',
    'murder for hire', 'contract killer', 'human trafficking',
    'child trafficking', 'sex trafficking', 'organ trafficking',

    // ========== FRAUD & ILLEGAL SERVICES ==========
    'fake id', 'fake passport', 'fake documents', 'forged documents',
    'stolen credit card', 'stolen cards', 'carding', 'card dumps',
    'money laundering', 'counterfeit', 'counterfeit money',
    'hacked accounts', 'hacked paypal', 'hacked bank',
    'ssn for sale', 'social security', 'identity theft',

    // ========== SCAMS & FRAUD SCHEMES ==========
    'pyramid scheme', 'ponzi', 'ponzi scheme', 'mlm scam',
    'get rich quick', 'guaranteed profit', 'guaranteed returns',
    'no work required', 'free money hack', 'money glitch',
    'double your money', 'investment scam', 'forex scam',

    // ========== GAMBLING (Borderline - include for safety) ==========
    'online casino', 'crypto gambling', 'betting site', 'gambling site',

    // ========== HATE SPEECH ==========
    'genocide', 'ethnic cleansing', 'hate speech', 'kill all',
    'death to', 'exterminate',

    // ========== HACKING & CYBERCRIME ==========
    'ddos service', 'ddos attack', 'botnet', 'ransomware',
    'malware', 'keylogger', 'phishing kit', 'exploit kit',
    'zero day', 'hacking service', 'hack for hire',
];

// Multi-word phrases that need exact substring matching
export const BLACKLIST_PHRASES: string[] = [
    'buy drugs',
    'sell drugs',
    'drug dealer',
    'drug trafficking',
    'fake passport',
    'fake id',
    'fake documents',
    'stolen credit card',
    'money laundering',
    'human trafficking',
    'child trafficking',
    'sex trafficking',
    'child porn',
    'kill for hire',
    'murder for hire',
    'hit man',
    'hitman',
    'pyramid scheme',
    'ponzi scheme',
    'get rich quick',
    'guaranteed profit',
    'no work required',
    'free money hack',
    'hacked accounts',
    'online casino',
    'gambling site',
    'betting site',
    'ethnic cleansing',
    'death to',
    'ddos service',
    'hack for hire',
    'onlyfans leak',
    'sugar daddy',
    'sugar baby',
];

// Build a Set for O(1) single-word lookups
export const BLACKLIST_SET = new Set<string>(
    BLACKLISTED_WORDS
        .filter(word => !word.includes(' ')) // Single words only
        .map(word => word.toLowerCase())
);
