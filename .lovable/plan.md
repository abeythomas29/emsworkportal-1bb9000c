# Research Portal Enhancement Plan: WhatsApp Integration & Daily Context

Integrate external communication (WhatsApp group updates) into the Research Lab to provide historical context for daily tests and results.

## User-facing changes

- **Message Ingestion**: A new "+ Paste Daily Messages" button in the Research Lab.
- **Context Display**: Research tests will now show relevant group messages from the same day, helping teams see "what else was happening" or "what was planned" alongside the formal log.
- **Series Integration**: Optionally link pasted messages to a specific series to keep project-specific discussions organized.
- **Daily View**: A "Daily Context" section in the test analysis dialog to show team communication alongside data.

## Technical details

### 1. Database Schema
Create a new table `public.research_messages`:
- `id`: uuid (PK)
- `user_id`: uuid (FK to profiles)
- `series_id`: uuid (FK to research_series, optional)
- `message_date`: date (default today)
- `content`: text (the raw pasted transcript)
- `source`: text (e.g., 'whatsapp')
- `metadata`: jsonb (for AI-extracted info later if needed)

### 2. Frontend Components
- **`ResearchMessageDialog`**: A modal to paste group messages.
- **`DailyContextCard`**: A small component to display messages for a specific date.
- **`useResearchMessages`**: A React Query hook to fetch and save these messages.

### 3. Integration Points
- **Research Page**: Add the button to log daily communication.
- **Test Card**: If messages exist for `test_date`, show a "Team Discussion" indicator/link.
- **Analysis Dialog**: Include relevant messages in the chronological view to provide a fuller picture for the R&D chemist (and the AI analyzer).

### 4. AI Analysis Update
- Pass the daily message context to the `analyze-research-tests` edge function to improve cause-and-effect reasoning.
