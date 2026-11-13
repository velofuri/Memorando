# Memória Visual

Jogo de apoio para avaliação e estimulação da memória visual em crianças (5 a 12 anos), aplicado pelo profissional em um tablet.

> Ferramenta de apoio, rastreio e estimulação cognitiva. **Não** é um teste psicológico aprovado pelo SATEPSI/CFP.

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # gera a versão final em dist/
npm run preview    # serve a versão final
```

Para usar no tablet, publique a pasta `dist/` em um servidor com **HTTPS** (necessário para funcionar offline e ser "instalado" na tela inicial). Depois do primeiro acesso, o app funciona sem internet.

## Modos

| Modo | O que a criança faz | Métrica principal |
|---|---|---|
| Reconhecimento da escolhida | Escolhe um cartão; após a pausa, encontra-o entre os mesmos cartões embaralhados | acertos, tempo de reação |
| Conjunto (reconhecimento) | Vê os cartões por X s; depois marca, entre vistos + novos, os que viu. N ensaios + evocação tardia opcional | curva de aprendizagem, falsos positivos |
| Conjunto (desenho) | Vê os cartões; desenha no papel; o profissional marca os desenhados | cartões lembrados, intrusões |
| Sequência (span) | Os cartões piscam um a um; repete a ordem. 2 tentativas por tamanho | maior sequência correta |

Qualquer modo pode ser aplicado em **modo treino** (mostra acerto/erro; não entra nos gráficos de evolução).

## Cartões

96 cartões gerados em SVG: 6 formas × 4 quantidades × 4 posições. A dificuldade controla quão parecidos são os cartões:

- **Fácil**: alvos e distratores diferem em 2+ atributos.
- **Médio**: metade dos distratores difere de algum alvo em só 1 atributo.
- **Difícil**: alvos podem diferir em 1 atributo entre si e todos os distratores são "quase iguais" a algum alvo.

## Dados

- Ficam só no dispositivo (IndexedDB). Use **Configurações → Exportar backup** regularmente; o app lembra após 30 dias.
- Paciente: código, data de nascimento e apelido opcional. Não registre nome completo nem CPF.
- Cada sessão guarda uma cópia do perfil usado; a evolução compara sessões do mesmo modo e mesmo nome de perfil.
- O PIN só impede que a criança saia do jogo ou veja resultados. Ele não criptografa os dados.

## Estrutura

```
src/lib/cards.ts       gerador de cartões, semelhança, distratores
src/lib/summary.ts     métricas por sessão
src/lib/report.ts      PDF e CSV
src/lib/backup.ts      backup JSON
src/games/             os quatro modos (tela da criança)
src/screens/           área do profissional
```
