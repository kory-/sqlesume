# SQL Resume

An interactive SQL terminal interface for exploring my professional background and skills through SQL queries.

## Overview

This project presents my resume data in the form of a SQL database, allowing visitors to explore my professional experience, skills, and background using SQL queries. It features both a SQL terminal mode and a basic Unix-like terminal interface.

## Features

- Interactive SQL terminal with syntax highlighting and auto-completion
- Support for common SQL commands and PostgreSQL-style commands
- Basic Unix-like terminal commands (`ls`, `imgcat`, etc.)
- Real-time query execution
- Responsive terminal interface
- Customizable resume data structure through JSON

## Available Databases

- `career_db`: Contains professional information including:
  - `personal_info`
  - `education`
  - `work_experience`
  - `qualifications`
  - `skills`
  - `companies`
- `private_db`: Contains personal information including:
  - `hobbies`

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start exploring.

## Example Queries

```sql
-- Show all available tables
SHOW TABLES;

-- View my skills
SELECT skill_name, level, years_used FROM skills;

-- Check my work experience
SELECT w.start_year, w.end_year, c.company_name, w.role 
FROM work_experience w 
JOIN companies c ON w.company_id = c.id;
```

## Customizing Resume Data

You can customize the resume data by modifying the JSON file at `data/personal_data.json`. The structure follows this format:

```json
{
  "databases": {
    "database_name": {
      "tables": {
        "table_name": {
          "columns": ["column1", "column2", ...],
          "data": [
            ["value1", "value2", ...],
            ["value1", "value2", ...],
            ...
          ]
        }
      }
    }
  }
}
```

### JSON Structure Rules

1. **Databases**: Create any number of databases to organize your data
2. **Tables**: Each database can contain multiple tables
3. **Columns**: Define column names as strings
4. **Data**: Provide rows of data as arrays matching the column order
5. **Data Types**: Supports:
   - Strings
   - Numbers
   - Dates (as strings in "YYYY-MM-DD" format)
   - "Present" keyword for current positions

### Example Structure

```json
{
  "databases": {
    "career_db": {
      "tables": {
        "skills": {
          "columns": ["id", "skill_name", "level", "years_used"],
          "data": [
            [1, "JavaScript", "Advanced", 5],
            [2, "Python", "Intermediate", 3]
          ]
        }
      }
    }
  }
}
```

## Technologies Used

- Next.js
- TypeScript
- AlaSQL
- Tailwind CSS

## License

MIT License - feel free to use this project as a template for your own SQL resume!
