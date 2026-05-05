# Couple Website

A private interactive website for couples — share photos, complete daily tasks, manage wish lists, send whispers, and track your love story.

## Features

- **Home** — Live love-duration counter, AI daily quotes, anniversary & birthday reminders
- **Album** — Photo upload with folder organization, tags, and thumbnail generation
- **Shop** — Virtual & physical goods store with a built-in currency system
- **Tasks** — Daily check-in, collaborative task tracker, task rewards
- **Private Space** — Password-protected private notes & file storage
- **Whispers** — Private messages between partners
- **Story** — Interactive love story timeline

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | HTML5, Tailwind CSS, JavaScript   |
| Backend  | PHP 7.4+ (API endpoints)         |
| Storage  | JSON file-based (no database)    |
| Icons    | Font Awesome                     |
| AI       | OpenAI / DeepSeek / DashScope API |

## Project Structure

```
├── index.html              # Login page
├── home.html               # Dashboard / landing
├── album.html              # Photo album
├── shop.html               # Shop & orders
├── task.html               # Tasks & check-in
├── story.html              # Love story timeline
├── private.html            # Password-protected private space
├── maintain.html           # Maintenance / under-construction page
├── api/                    # PHP API endpoints
│   ├── login.php           # Authentication
│   ├── checkin.php         # Daily check-in
│   ├── tasks.php           # Task CRUD
│   ├── photos.php          # Photo upload & management
│   ├── folders.php         # Album folders
│   ├── shop.php            # Product listing & purchase
│   ├── orders.php          # Order management
│   ├── reviews.php         # Product reviews
│   ├── story.php           # Story event management
│   ├── whispers.php        # Partner messages
│   ├── private-files.php   # Private file upload
│   ├── private-notes.php   # Private notes
│   ├── private-auth.php    # Private space authentication
│   ├── upload-avatar.php   # Avatar upload
│   ├── upload-photo.php    # Photo upload
│   ├── app-config.php      # Frontend app configuration
│   ├── balance.php         # Currency balance
│   ├── csrf-token.php      # CSRF token provider
│   └── daily-quote.php     # AI-generated daily quote
├── includes/               # PHP helper libraries
│   ├── config.php          # Configuration loader
│   ├── session.php         # Session management
│   ├── auth.php            # Authentication helpers
│   └── ...                 # Domain helpers (shop, tasks, album, etc.)
├── assets/                 # Static assets (CSS, JS, images)
├── data/                   # JSON data files (gitignored except .example)
│   ├── config.json.example
│   ├── ai_config.json.example
│   ├── products.txt        # Product definitions
│   └── tasks.txt           # Task pool definitions
└── uploads/                # User uploads (gitignored)
    ├── avatars/
    ├── photos/
    └── private/
```

## Quick Start

### Requirements

- PHP 7.4+
- Any web server (Apache, Nginx, or PHP built-in)
- Write permissions on `data/` and `uploads/`

### Setup

```bash
# Clone the repo
git clone https://github.com/seventeenlyc/couple-website.git
cd couple-website

# Start a dev server
php -S localhost:8080
```

### Configuration

Copy the example config files and edit them:

```bash
cp data/config.json.example data/config.json
cp data/ai_config.json.example data/ai_config.json
```

**`data/config.json`** — set your user names, passwords, anniversary date, and birthdays:

```json
{
  "startDate": "2024-02-14",
  "users": {
    "name1": {
      "id": "id1",
      "password": "your-password",
      "privatePassword": "private-password",
      "partner": "name2",
      "birthday": "01-01"
    },
    "name2": {
      "id": "id2",
      "password": "partner-password",
      "privatePassword": "partner-private-password",
      "partner": "name1",
      "birthday": "02-14"
    }
  }
}
```

**`data/ai_config.json`** — optionally enable AI-powered features:

```json
{
  "enabled": true,
  "api_provider": "openai",
  "api_key": "sk-your-api-key",
  "model": "gpt-3.5-turbo"
}
```

Supported providers: `openai`, `deepseek`, `dashscope`, `anthropic`.

### File Permissions

```bash
chmod 777 -R data/
chmod 777 -R uploads/
```

## Security

- Passwords are stored in `config.json` (consider hashing for production)
- CSRF protection on all state-changing requests
- Private spaces have independent password protection
- `data/*.json` and `uploads/*` are gitignored to prevent accidental leaks
- Server-side API key handling (keys never exposed to the frontend)

## License

For personal use and learning. Not for commercial use.
