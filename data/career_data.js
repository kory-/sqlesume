const CAREER_DB = {
    databases: {
        career_db: {
            tables: {
                engineers: {
                    columns: ['id', 'name', 'years_of_experience', 'current_position'],
                    data: [
                        [1, '山田太郎', 8, 'シニアエンジニア'],
                        [2, '鈴木花子', 5, 'フルスタックエンジニア']
                    ]
                },
                skills: {
                    columns: ['id', 'engineer_id', 'skill_name', 'years_used'],
                    data: [
                        [1, 1, 'Python', 5],
                        [2, 1, 'JavaScript', 3],
                        [3, 2, 'Ruby', 4]
                    ]
                },
                projects: {
                    columns: ['id', 'engineer_id', 'project_name', 'description', 'duration_months'],
                    data: [
                        [1, 1, '顧客管理システム', 'Railsによる社内システム開発', 12],
                        [2, 2, 'ECサイト', 'React/NodeによるEC開発', 8]
                    ]
                }
            }
        },
        private_db: {
            tables: {
                games: {
                    columns: ['id', 'title', 'platform', 'genre', 'play_time', 'completion_status'],
                    data: [
                        [1, 'ゼルダの伝説 ティアーズ オブ ザ キングダム', 'Nintendo Switch', 'アクションRPG', 120, 'クリア済み'],
                        [2, 'ファイナルファンタジーXVI', 'PS5', 'RPG', 85, 'メインクリア'],
                        [3, 'スプラトゥーン3', 'Nintendo Switch', 'シューター', 200, '進行中']
                    ]
                },
                anime: {
                    columns: ['id', 'title', 'genre', 'episodes', 'status', 'rating'],
                    data: [
                        [1, '葬送のフリーレン', 'ファンタジー', 28, '視聴中', 9],
                        [2, 'チェンソーマン', 'アクション', 12, '視聴完了', 8],
                        [3, '推しの子', 'ドラマ', 11, '視聴完了', 9]
                    ]
                },
                books: {
                    columns: ['id', 'title', 'author', 'genre', 'format', 'status'],
                    data: [
                        [1, '三体', '劉慈欣', 'SF', '電子書籍', '読了'],
                        [2, '響け！ユーフォニアム', '武田綾乃', '青春小説', '文庫', '読了'],
                        [3, 'ソフトウェアデザイン 2024年1月号', '技術評論社', '技術書', '雑誌', '読書中']
                    ]
                }
            }
        }
    }
}; 