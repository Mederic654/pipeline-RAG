# Évaluation baseline RAG

## Méthodologie
Cette baseline est remplie manuellement à partir des résultats retournés par `ragQuery(question, { topK: 5, verbose: true })`.

- `answer`
- `sources`
- `metrics.topScore`
- `metrics.avgScore`

## Tableau d’évaluation

| # | Type | Question | Top-1 score | Avg top 3 score | Token | Coût | Pertinence | Fidélité | Notes |
|---|------|----------|-------------|-----------|---------|---------|-------|
| 1 | Happy | Comment définir un outil dans Pydantic AI ?   | 0.81 | 0.80 |  | ... | ... |
| 2 | Happy | Quelle est la différence entre RunContext ?   | ... | ... | ... | ... | ... |
| 3 | Happy | Comment streamer une réponse ?                | ... | ... | ... | ... | ... |
| 4 | Happy | Comment fonctionnent les toolsets ?           | ... | ... | ... | ... | ... |
| 5 | Happy | Comment utiliser les modèles OpenAI ?         | ... | ... | ... | ... | ... |
| 6 | Happy | Comment fonctionnent les evals ?              | ... | ... | ... | ... | ... |
| 7 | Ambiguë | Comment gérer les erreurs ?                 | ... | ... | ... | ... | ... |
| 8 | Ambiguë | Comment configurer les modèles ?            | ... | ... | ... | ... | ... |
| 9 | Adversariale | Quel est le PIB de la France en 2023 ? | ... | ... | ... | ... | ... |
| 10 | Adversariale | Comment cuire des pâtes carbonara ?   | ... | ... | ... | ... | ... |

## Agrégats

- **Moyenne Top-1 score** : ...
- **Moyenne Avg score** : ...
- **Nombre de réponses correctes / satisfaisantes** : ...
- **Nombre de réponses “Je ne trouve pas cette information dans les documents fournis”** : ...

## Lecture rapide
- `Top-1 score` = meilleur score remonté par `ragQuery().metrics.topScore`
- `Avg score` = moyenne des scores remontée par `ragQuery().metrics.avgScore`
- `Sources` = liste des fichiers retournés par `ragQuery().sources`
- `Réponse` = texte renvoyé par `ragQuery().answer`
- `Notes` = observations rapides (bonne réponse, réponse trop vague, sources pertinentes, hors corpus bien géré, etc.)
 