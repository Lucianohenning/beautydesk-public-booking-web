# BeautyDesk Public Booking Web

Frontend público separado para o link de agendamento online das profissionais BeautyDesk.

## Objetivo

Rodar fora do app principal, mantendo a mesma API e o mesmo slug da profissional.

Exemplo novo:

```txt
https://agenda.beautydesk.app.br/sublime-olhar
```

Compatível também com:

```txt
https://agenda.beautydesk.app.br/public/sublime-olhar
```

## Endpoints usados

```txt
GET  https://api.beautydesk.app.br/public/company/:slug
GET  https://api.beautydesk.app.br/public/company/:slug/availability?serviceId=...&date=YYYY-MM-DD
POST https://api.beautydesk.app.br/public/company/:slug/appointments
```

## Deploy no Render

Tipo: Static Site

Build Command: vazio

Publish Directory:

```txt
.
```

## Rewrite obrigatório no Render

```txt
Source: /*
Destination: /index.html
Action: Rewrite
```

## CORS na API

Adicionar no `CORS_ORIGIN` do backend no Render:

```txt
https://agenda.beautydesk.app.br
```

Exemplo com múltiplas origens:

```txt
https://app.beautydesk.app.br,https://beautydesk-web.onrender.com,https://agenda.beautydesk.app.br
```

## Arquivos

```txt
index.html
styles.css
app.js
```

## Observação

Este projeto não altera backend, banco, regras de sinal, disponibilidade, timezone, assinatura ou status do agendamento. Ele apenas separa a experiência pública da cliente final.
