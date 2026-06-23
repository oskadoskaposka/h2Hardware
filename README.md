# H2 Hardware Website — Handover / Manual

Este documento descreve como o site da H2 Hardware funciona, quais páginas existem, quais regras de negócio estão implementadas e como operar a área administrativa.

This document explains how the H2 Hardware website works, which pages exist, what business rules are implemented, and how to operate the admin area.

---

# Português

## 1. Visão geral

O site da H2 Hardware é um catálogo comercial com fluxo de carrinho, pedidos, solicitações de amostra e solicitação de acesso de usuários.

A aplicação foi construída com:

- Next.js App Router
- React
- TypeScript
- Firebase Hosting
- Firebase Authentication
- Firestore
- Firebase Cloud Functions

O site é hospedado pelo Firebase Hosting e publicado como site estático na pasta `out`.

Domínio principal atual:

```txt
h2hardwareltd.com
```

Projeto Firebase atual:

```txt
starpro-web
```

---

## 2. Conceitos principais

### 2.1 Catálogo

O catálogo é a entrada principal do site. Ele mostra produtos ativos, filtros por categoria/subcategoria, carousel e cards de produto.

Rotas:

```txt
/
/catalog
```

As duas rotas usam a mesma experiência de catálogo.

### 2.2 Produtos

Cada produto possui uma página de detalhe acessada por slug.

Rota:

```txt
/product?slug=PRODUCT_SLUG
```

A página de produto mostra:

- nome;
- modelo;
- categoria principal;
- subcategoria;
- imagens;
- descrição;
- features;
- preço unitário;
- tiers de preço, quando aplicável;
- estoque;
- peso unitário, quando preenchido;
- botão de adicionar ao carrinho.

### 2.3 Carrinho

O carrinho é salvo no navegador do cliente usando `localStorage`.

Chave atual:

```txt
starpro_cart_v1
```

O carrinho salva apenas:

- `slug` do produto;
- `qty` do produto.

O preço não fica salvo no carrinho. Ele é sempre recalculado usando os dados atuais do produto no Firestore.

O header mostra um contador no link **View Cart**. Esse número representa a soma total de unidades no carrinho.

Exemplo:

```txt
Produto A: 3 unidades
Produto B: 2 unidades
View Cart: 5
```

---

## 3. Rotas públicas

### `/` e `/catalog`

Página principal do catálogo.

Funções:

- listar produtos ativos;
- filtrar por categoria principal;
- filtrar por subcategoria;
- exibir carousel configurável;
- abrir produto pelo card;
- exibir destaque visual em categorias configuradas pelo admin.

Comportamentos importantes:

- a opção visual `All in ...` da subcategoria foi escondida, mas a lógica interna não foi apagada;
- categorias destacadas são lidas de `site_config/catalog_menu`;
- o destaque de categoria usa botão vermelho com texto amarelo.

### `/product?slug=...`

Página de detalhe do produto.

Funções:

- mostrar informações completas do produto;
- calcular preço conforme quantidade;
- aplicar tiers para usuários logados;
- adicionar produto ao carrinho;
- exibir aviso quando a quantidade precisa de confirmação de disponibilidade.

### `/cart`

Página do carrinho.

Funções:

- listar itens adicionados;
- alterar quantidade;
- remover itens;
- recalcular total;
- seguir para checkout.

### `/checkout`

Página de finalização do pedido.

Funções:

- coletar dados do cliente;
- coletar endereço de entrega;
- gerar pedido no Firestore;
- permitir geração/visualização de PDF conforme implementação atual;
- disparar notificação de novo pedido via Cloud Function.

### `/orders`

Página de pedidos do cliente.

Funções:

- exibir pedidos relacionados ao usuário logado;
- permitir consulta de histórico de pedidos.

### `/login`

Página de login.

Funções:

- autenticar usuário via Firebase Authentication;
- permitir reset de senha;
- direcionar usuários administrativos para áreas admin quando aplicável.

Regra importante:

- o login não coleta endereço;
- endereço é coletado no checkout e no registration request.

### `/registration-request`

Formulário público para solicitar acesso.

Campos principais:

- nome;
- e-mail;
- empresa;
- endereço de entrega.

Comportamento:

- o envio cria um documento em `registration_requests`;
- o usuário não é criado automaticamente no Firebase Auth;
- um admin precisa aprovar a solicitação pela tela administrativa;
- a notificação de nova solicitação é enviada por Cloud Function.

### `/sample-request`

Formulário público para solicitar amostras.

Campos principais:

- nome da empresa;
- website;
- URL da imagem do cartão/nome;
- telefone;
- e-mail;
- endereço de entrega.

Regras de validação atuais:

- nome da empresa é obrigatório;
- endereço de entrega é obrigatório;
- é necessário preencher pelo menos website ou URL da imagem do cartão;
- é necessário preencher pelo menos telefone ou e-mail.

Mensagem de sucesso atual:

```txt
Thanks, we will review your info and send you the sample.
```

### `/about`

Página institucional.

### `/contact`

Página de contato.

---

## 4. Rotas administrativas

A área administrativa aparece no header quando o e-mail logado é considerado admin.

A lista do front é controlada por:

```txt
NEXT_PUBLIC_ADMIN_EMAILS
```

Importante: essa variável é pública e usada pelo front. Qualquer alteração exige novo build e novo deploy do hosting.

### `/admin/orders`

Tela administrativa de pedidos.

Funções:

- visualizar pedidos de todos os clientes;
- pesquisar por pedido, e-mail, nome, UID ou produto;
- revisar dados de entrega;
- gerar/abrir PDF, conforme implementação atual.

### `/admin/products`

Tela de gestão de produtos.

Funções:

- criar produto;
- editar produto;
- ativar/desativar produto;
- organizar ordenação;
- configurar categoria e subcategoria;
- configurar preço público;
- configurar tiers;
- configurar estoque;
- configurar imagens e descrição.

### `/admin/products/edit`

Tela de edição/criação de produto.

Campos importantes:

- `slug`;
- `name`;
- `model`;
- `series`;
- `category`;
- `description`;
- `publicPrice`;
- `currency`;
- `tiers`;
- `stock`;
- `unitWeight`;
- `weightUnit`;
- `images`;
- `features`;
- `active`;
- `sortOrder`.

Mapeamento importante:

```txt
series   = categoria principal
category = subcategoria
```

Esse mapeamento deve ser preservado para evitar quebrar filtros existentes.

### `/admin/carousel-builder`

Tela de configuração do carousel do catálogo.

Documento usado:

```txt
site_config/catalog_carousel
```

Cada slide pode ser configurado com:

- título;
- subtítulo;
- imagem;
- tipo de link;
- categoria;
- subcategoria;
- product slug;
- page path;
- URL externa.

Tipos de link suportados:

```txt
filter
product
page
url
```

Comportamento:

- `filter`: aplica filtro no catálogo;
- `product`: abre a página de produto;
- `page`: abre uma rota interna, como `/sample-request`;
- `url`: abre link externo.

### `/admin/category-highlights`

Tela para escolher categorias com destaque visual no menu do catálogo.

Documento usado:

```txt
site_config/catalog_menu
```

Campo usado:

```txt
highlightedCategories: string[]
```

Comportamento:

- as categorias escolhidas aparecem com botão vermelho e texto amarelo;
- o destaque é visual, não altera produtos nem filtros;
- a configuração afeta `/` e `/catalog`.

### `/admin/sample-requests`

Tela para revisar solicitações de amostra.

Funções:

- listar solicitações;
- pesquisar por empresa, website, telefone, e-mail e endereço;
- abrir URL da imagem do cartão;
- revisar endereço de entrega.

### `/admin/registration-requests`

Tela para revisar solicitações de criação de usuário.

Funções:

- listar solicitações de acesso;
- pesquisar por nome, e-mail, empresa, endereço ou status;
- aprovar/criar usuário no Firebase Auth;
- reativar usuário desativado;
- desativar usuário sem apagar histórico;
- salvar dados em `customers` ao aprovar.

Botões principais:

- **Approve / Create User**: cria ou habilita o usuário no Firebase Auth;
- **Approve / Enable User**: reativa usuário já existente/desativado;
- **Disable User**: bloqueia login do usuário sem apagar a solicitação.

Implementação atual dos botões:

- o front chama rotas do próprio domínio:

```txt
/api/admin/registration-requests/approve
/api/admin/registration-requests/disable
```

- o Firebase Hosting redireciona essas rotas para Cloud Functions HTTP:

```txt
approveRegistrationRequestHttp
disableRegistrationUserHttp
```

Isso evita chamadas diretas para `cloudfunctions.net` e reduz problemas de CORS.

---

## 5. Regras de negócio

### 5.1 Preço público e tiers

Cada produto deve ter um preço público.

Campo principal:

```txt
publicPrice
```

Produtos também podem ter tiers:

```ts
tiers: [
  {
    minQty: number,
    maxQty?: number | null,
    price: number
  }
]
```

Regras:

- usuários não logados veem preço público;
- usuários logados podem ver preço aplicado conforme tiers;
- a página de produto calcula preço considerando a quantidade selecionada mais a quantidade já existente no carrinho para o mesmo produto.

### 5.2 Estoque e regra dos 80%

Existe uma regra de disponibilidade baseada em 80% do estoque.

Comportamento atual:

- o sistema calcula internamente 80% do estoque;
- se a quantidade solicitada ultrapassar esse limite, o item ainda é adicionado ao carrinho;
- o cliente vê uma mensagem dizendo que a equipe confirmará a disponibilidade;
- o cliente não deve ver detalhes internos da regra ou do limite de estoque.

Mensagem usada quando precisa de confirmação:

```txt
Added to cart. Our team will confirm availability for this quantity.
```

Motivo da regra:

- evitar bloquear a compra de imediato;
- não expor quantidades internas de estoque;
- permitir que a equipe confirme disponibilidade manualmente.

### 5.3 Carrinho

Regras:

- carrinho fica no navegador do cliente;
- o mesmo produto somado novamente incrementa a quantidade;
- remover item ou alterar quantidade dispara atualização do contador no header;
- o contador mostra unidades totais, não quantidade de produtos distintos.

### 5.4 Checkout e pedido

Regras:

- checkout coleta dados do cliente e endereço de entrega;
- pedido é salvo em `orders`;
- notificação de novo pedido é enviada para a equipe;
- preços são recalculados com base nos produtos atuais.

### 5.5 Registration request

Regras:

- o formulário público não cria usuário automaticamente;
- admin precisa aprovar manualmente;
- ao aprovar, a function cria ou habilita usuário no Firebase Auth;
- os dados principais são salvos/atualizados em `customers`;
- o endereço de entrega deve ser preservado;
- login não deve pedir endereço.

### 5.6 Sample request

Regras:

- solicitação de amostra não cria pedido;
- solicitação é salva em `sample_requests`;
- equipe revisa manualmente;
- notificação é enviada por Cloud Function.

### 5.7 Admins

Existem dois níveis de validação de admin:

1. Front-end: controla visibilidade do menu admin.
2. Server-side/functions: controla permissão real para ações sensíveis.

Atenção:

- o front usa `NEXT_PUBLIC_ADMIN_EMAILS`;
- functions podem usar `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS` ou a lista `DEFAULT_ADMIN_EMAILS` no código;
- se o admin vê a página, mas recebe `Only admins can perform this action`, significa que o e-mail está liberado no front, mas não está liberado no server-side ou as functions ainda não foram redeployadas.

Correção típica:

1. adicionar o e-mail admin no server-side;
2. rodar build das functions;
3. fazer deploy das functions.

---

## 6. Coleções Firestore

### `products`

Armazena os produtos do catálogo.

Campos comuns:

```txt
slug
name
model
series
category
description
publicPrice
currency
tiers
stock
unitWeight
weightUnit
active
sortOrder
images
features
createdAt
updatedAt
```

### `orders`

Armazena pedidos.

Campos comuns:

```txt
uid
userEmail
customer
items
total
currency
shippingAddress
createdAt
```

### `registration_requests`

Armazena solicitações de acesso.

Campos comuns:

```txt
name
email
company
shippingAddress
status
authUid
createdAt
approvedAt
approvedByEmail
disabledAt
disabledByEmail
updatedAt
```

Status comuns:

```txt
new
approved
disabled
```

### `customers`

Armazena dados do cliente após aprovação.

Campos comuns:

```txt
name
company
email
shippingAddress
disabled
createdAt
updatedAt
```

### `sample_requests`

Armazena solicitações de amostra.

Campos comuns:

```txt
companyName
website
nameCardImageUrl
phone
email
deliveryAddress
thankYouText
status
createdAt
```

### `site_config/catalog_carousel`

Armazena configuração do carousel do catálogo.

### `site_config/catalog_menu`

Armazena configuração visual do menu de categorias.

Campo principal:

```txt
highlightedCategories
```

---

## 7. Cloud Functions

Functions atuais principais:

```txt
notifyNewOrder
notifyNewRegistrationRequest
notifyNewSampleRequest
approveRegistrationRequest
disableRegistrationUser
approveRegistrationRequestHttp
disableRegistrationUserHttp
```

### Notificações

As functions de notificação disparam e-mails quando documentos são criados em:

```txt
orders/{orderId}
registration_requests/{requestId}
sample_requests/{requestId}
```

Secrets necessários:

```txt
SMTP_USER
SMTP_PASSWORD
```

### Approve/Disable de usuários

As actions administrativas usam HTTP functions por trás do Firebase Hosting.

Rotas públicas do site:

```txt
/api/admin/registration-requests/approve
/api/admin/registration-requests/disable
```

Rewrites em `firebase.json` apontam para:

```txt
approveRegistrationRequestHttp
disableRegistrationUserHttp
```

Essas actions validam o token do usuário logado usando Firebase Auth.

---

## 8. Variáveis de ambiente

Variáveis públicas do Next/Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_EMAILS=admin@starpro.com,admin@h2hardware.com
```

Observações:

- variáveis `NEXT_PUBLIC_*` entram no build do front;
- qualquer alteração exige novo build e deploy de hosting;
- admins usados nas functions também precisam estar disponíveis no server-side.

Secrets das functions:

```txt
SMTP_USER
SMTP_PASSWORD
```

---

## 9. Build e deploy

### Instalar dependências

```bash
npm install
npm --prefix functions install
```

### Rodar localmente

```bash
npm run dev
```

### Build do site

```bash
npm run build
```

### Build das functions

```bash
npm --prefix functions run build
```

### Deploy completo

```bash
firebase deploy --only hosting,functions --project starpro-web
```

### Deploy apenas do hosting

Use quando alterar apenas front, CSS, páginas ou documentação pública do site.

```bash
firebase deploy --only hosting --project starpro-web
```

### Deploy apenas das functions

Use quando alterar Cloud Functions, notificações ou approve/disable de usuários.

```bash
firebase deploy --only functions --project starpro-web
```

### Deploy específico das actions de usuário

```bash
firebase deploy --only functions:approveRegistrationRequestHttp,functions:disableRegistrationUserHttp,functions:approveRegistrationRequest,functions:disableRegistrationUser --project starpro-web
```

---

## 10. Manual de uso rápido

### Cliente comprando produtos

1. Acessar `/` ou `/catalog`.
2. Filtrar por categoria/subcategoria, se necessário.
3. Abrir produto.
4. Escolher quantidade.
5. Adicionar ao carrinho.
6. Conferir contador do carrinho no header.
7. Ir para `/cart`.
8. Finalizar em `/checkout`.

### Cliente solicitando acesso

1. Acessar `/registration-request`.
2. Preencher nome, e-mail, empresa e endereço.
3. Enviar solicitação.
4. Aguardar aprovação da equipe.
5. Após aprovação, usar reset de senha no login para criar a senha.

### Admin aprovando usuário

1. Entrar com e-mail admin.
2. Abrir `/admin/registration-requests`.
3. Localizar solicitação.
4. Clicar em **Approve / Create User**.
5. Orientar cliente a usar **Forgot password** no login.

### Admin desativando usuário

1. Abrir `/admin/registration-requests`.
2. Localizar usuário aprovado.
3. Clicar em **Disable User**.
4. O usuário fica bloqueado no Firebase Auth, sem apagar histórico.

### Admin destacando categoria

1. Abrir `/admin/category-highlights`.
2. Selecionar categorias.
3. Salvar.
4. Conferir destaque em `/` e `/catalog`.

### Admin editando carousel

1. Abrir `/admin/carousel-builder`.
2. Criar ou editar slides.
3. Escolher tipo de link.
4. Salvar.
5. Conferir em `/` ou `/catalog`.

### Admin editando produtos

1. Abrir `/admin/products`.
2. Criar ou editar produto.
3. Conferir `series` como categoria principal.
4. Conferir `category` como subcategoria.
5. Salvar.
6. Conferir no catálogo.

---

## 11. Checklist de validação

Após deploy, validar:

- domínio abre corretamente;
- catálogo carrega produtos;
- filtros de categoria funcionam;
- subcategoria `All in ...` não aparece visualmente;
- category highlights aparecem no catálogo;
- produto abre por slug;
- preço público aparece para usuário não logado;
- tiers aparecem/aplicam para usuário logado;
- adicionar ao carrinho funciona;
- contador do carrinho atualiza;
- checkout cria pedido;
- admin orders carrega;
- sample request envia;
- admin sample requests carrega;
- registration request envia;
- admin registration requests carrega;
- approve/create user funciona;
- disable user funciona;
- e-mails de notificação chegam.

---

## 12. Pontos de atenção conhecidos

### Admin consegue ver a página, mas não consegue aprovar

Sintoma:

```txt
Only admins can perform this action.
```

Causa provável:

- e-mail liberado no front, mas não liberado nas functions;
- functions não redeployadas após alterar lista de admins;
- variável server-side `ADMIN_EMAILS` não configurada.

Correção:

- alinhar `NEXT_PUBLIC_ADMIN_EMAILS`, `ADMIN_EMAILS` e `DEFAULT_ADMIN_EMAILS`;
- fazer build e deploy das functions.

### CORS em approve/disable

A solução atual evita chamada direta para `cloudfunctions.net` usando rotas do próprio domínio via Firebase Hosting rewrites.

Se CORS voltar a aparecer, conferir:

- se `firebase.json` tem rewrites `/api/admin/...`;
- se as HTTP functions foram deployadas;
- se o front está chamando `/api/admin/...` e não `cloudfunctions.net` diretamente.

### Alteração de admins

Alterar admin no front exige novo build/deploy de hosting.

Alterar admin nas functions exige build/deploy das functions.

### Static hosting / prefetch

O site usa Firebase Hosting com export estático. Links principais usam `prefetch={false}` para evitar requisições automáticas desnecessárias que podem gerar 404 em ambiente estático.

---

# English

## 1. Overview

The H2 Hardware website is a commercial catalog with cart, order, sample request, and account access request flows.

The application was built with:

- Next.js App Router
- React
- TypeScript
- Firebase Hosting
- Firebase Authentication
- Firestore
- Firebase Cloud Functions

The site is hosted on Firebase Hosting and published as a static site from the `out` folder.

Current main domain:

```txt
h2hardwareltd.com
```

Current Firebase project:

```txt
starpro-web
```

---

## 2. Main concepts

### 2.1 Catalog

The catalog is the main entry point of the website. It displays active products, category/subcategory filters, carousel, and product cards.

Routes:

```txt
/
/catalog
```

Both routes use the same catalog experience.

### 2.2 Products

Each product has a detail page accessed by slug.

Route:

```txt
/product?slug=PRODUCT_SLUG
```

The product page displays:

- name;
- model;
- main category;
- subcategory;
- images;
- description;
- features;
- unit price;
- price tiers, when applicable;
- stock;
- unit weight, when filled;
- add to cart button.

### 2.3 Cart

The cart is stored in the customer's browser using `localStorage`.

Current key:

```txt
starpro_cart_v1
```

The cart stores only:

- product `slug`;
- product `qty`.

Prices are not stored in the cart. They are always recalculated from the current Firestore product data.

The header shows a counter next to **View Cart**. This number is the total number of units in the cart.

Example:

```txt
Product A: 3 units
Product B: 2 units
View Cart: 5
```

---

## 3. Public routes

### `/` and `/catalog`

Main catalog page.

Features:

- list active products;
- filter by main category;
- filter by subcategory;
- display configurable carousel;
- open product cards;
- show visual highlight for admin-selected categories.

Important behaviors:

- the visual `All in ...` subcategory option is hidden, but the internal filtering logic was not deleted;
- highlighted categories are read from `site_config/catalog_menu`;
- category highlight uses a red button with yellow text.

### `/product?slug=...`

Product detail page.

Features:

- display full product information;
- calculate pricing by quantity;
- apply tiers for logged-in users;
- add product to cart;
- show availability confirmation notice when needed.

### `/cart`

Cart page.

Features:

- list added items;
- update quantity;
- remove items;
- recalculate total;
- continue to checkout.

### `/checkout`

Order checkout page.

Features:

- collect customer data;
- collect delivery address;
- create order in Firestore;
- allow PDF generation/viewing according to the current implementation;
- trigger new order notification through Cloud Functions.

### `/orders`

Customer orders page.

Features:

- display orders related to the logged-in user;
- allow customers to review their order history.

### `/login`

Login page.

Features:

- authenticate users through Firebase Authentication;
- allow password reset;
- show admin access when the logged-in user is an admin.

Important rule:

- login does not collect address information;
- address is collected on checkout and registration request.

### `/registration-request`

Public form to request account access.

Main fields:

- name;
- email;
- company;
- delivery address.

Behavior:

- submission creates a document in `registration_requests`;
- the Firebase Auth user is not created automatically;
- an admin must approve the request in the admin area;
- a notification is sent by Cloud Function.

### `/sample-request`

Public form to request samples.

Main fields:

- company name;
- website;
- name card image URL;
- phone;
- email;
- delivery address.

Current validation rules:

- company name is required;
- delivery address is required;
- either website or name card image URL is required;
- either phone or email is required.

Current success message:

```txt
Thanks, we will review your info and send you the sample.
```

### `/about`

Company information page.

### `/contact`

Contact page.

---

## 4. Admin routes

The admin area appears in the header when the logged-in email is considered an admin.

The frontend list is controlled by:

```txt
NEXT_PUBLIC_ADMIN_EMAILS
```

Important: this variable is public and used by the frontend. Any change requires a new build and hosting deploy.

### `/admin/orders`

Admin orders page.

Features:

- view all customer orders;
- search by order ID, email, name, UID, or product;
- review delivery data;
- generate/open PDF according to the current implementation.

### `/admin/products`

Product management page.

Features:

- create product;
- edit product;
- activate/deactivate product;
- manage sort order;
- configure category and subcategory;
- configure public price;
- configure tiers;
- configure stock;
- configure images and description.

### `/admin/products/edit`

Product create/edit page.

Important fields:

- `slug`;
- `name`;
- `model`;
- `series`;
- `category`;
- `description`;
- `publicPrice`;
- `currency`;
- `tiers`;
- `stock`;
- `unitWeight`;
- `weightUnit`;
- `images`;
- `features`;
- `active`;
- `sortOrder`.

Important mapping:

```txt
series   = main category
category = subcategory
```

This mapping should be preserved to avoid breaking existing filters.

### `/admin/carousel-builder`

Catalog carousel configuration page.

Document used:

```txt
site_config/catalog_carousel
```

Each slide can be configured with:

- title;
- subtitle;
- image;
- link type;
- category;
- subcategory;
- product slug;
- page path;
- external URL.

Supported link types:

```txt
filter
product
page
url
```

Behavior:

- `filter`: applies catalog filter;
- `product`: opens product page;
- `page`: opens an internal route, such as `/sample-request`;
- `url`: opens an external link.

### `/admin/category-highlights`

Page to choose visually highlighted catalog categories.

Document used:

```txt
site_config/catalog_menu
```

Field used:

```txt
highlightedCategories: string[]
```

Behavior:

- selected categories appear with a red button and yellow text;
- the highlight is visual only and does not change products or filters;
- the configuration affects `/` and `/catalog`.

### `/admin/sample-requests`

Page to review sample requests.

Features:

- list sample requests;
- search by company, website, phone, email, and address;
- open name card image URL;
- review delivery address.

### `/admin/registration-requests`

Page to review account access requests.

Features:

- list access requests;
- search by name, email, company, address, or status;
- approve/create user in Firebase Auth;
- re-enable disabled users;
- disable users without deleting history;
- save customer data to `customers` when approving.

Main buttons:

- **Approve / Create User**: creates or enables the Firebase Auth user;
- **Approve / Enable User**: re-enables an existing disabled user;
- **Disable User**: blocks user login without deleting request history.

Current button implementation:

- the frontend calls same-origin routes:

```txt
/api/admin/registration-requests/approve
/api/admin/registration-requests/disable
```

- Firebase Hosting rewrites these routes to HTTP Cloud Functions:

```txt
approveRegistrationRequestHttp
disableRegistrationUserHttp
```

This avoids direct calls to `cloudfunctions.net` and reduces CORS issues.

---

## 5. Business rules

### 5.1 Public price and tiers

Each product should have a public price.

Main field:

```txt
publicPrice
```

Products can also have tiers:

```ts
tiers: [
  {
    minQty: number,
    maxQty?: number | null,
    price: number
  }
]
```

Rules:

- non-logged users see public price;
- logged-in users can receive tier pricing;
- product page pricing considers selected quantity plus quantity already in cart for the same product.

### 5.2 Stock and 80% rule

There is an availability rule based on 80% of product stock.

Current behavior:

- the system internally calculates 80% of stock;
- if requested quantity exceeds this limit, the item is still added to cart;
- the customer sees a message saying the team will confirm availability;
- the customer should not see internal stock threshold details.

Message used when confirmation is required:

```txt
Added to cart. Our team will confirm availability for this quantity.
```

Reason for this rule:

- avoid blocking the customer immediately;
- avoid exposing internal stock quantities;
- allow the team to confirm availability manually.

### 5.3 Cart

Rules:

- cart is stored in the customer's browser;
- adding the same product again increments quantity;
- removing an item or changing quantity updates the header counter;
- the counter shows total units, not distinct products.

### 5.4 Checkout and orders

Rules:

- checkout collects customer data and delivery address;
- order is saved in `orders`;
- new order notification is sent to the team;
- prices are recalculated using current product data.

### 5.5 Registration request

Rules:

- the public form does not create users automatically;
- admin must approve manually;
- when approved, the function creates or enables the user in Firebase Auth;
- main data is saved/updated in `customers`;
- delivery address must be preserved;
- login should not request address information.

### 5.6 Sample request

Rules:

- sample request does not create an order;
- request is saved in `sample_requests`;
- team reviews it manually;
- notification is sent through Cloud Functions.

### 5.7 Admins

There are two levels of admin validation:

1. Frontend: controls admin menu visibility.
2. Server-side/functions: controls real permission for sensitive actions.

Attention:

- frontend uses `NEXT_PUBLIC_ADMIN_EMAILS`;
- functions can use `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`, or code-level `DEFAULT_ADMIN_EMAILS`;
- if an admin sees the page but receives `Only admins can perform this action`, the email is allowed on the frontend but not on the server-side, or functions were not redeployed.

Typical fix:

1. add the admin email on the server-side;
2. build functions;
3. deploy functions.

---

## 6. Firestore collections

### `products`

Stores catalog products.

Common fields:

```txt
slug
name
model
series
category
description
publicPrice
currency
tiers
stock
unitWeight
weightUnit
active
sortOrder
images
features
createdAt
updatedAt
```

### `orders`

Stores orders.

Common fields:

```txt
uid
userEmail
customer
items
total
currency
shippingAddress
createdAt
```

### `registration_requests`

Stores account access requests.

Common fields:

```txt
name
email
company
shippingAddress
status
authUid
createdAt
approvedAt
approvedByEmail
disabledAt
disabledByEmail
updatedAt
```

Common statuses:

```txt
new
approved
disabled
```

### `customers`

Stores customer data after approval.

Common fields:

```txt
name
company
email
shippingAddress
disabled
createdAt
updatedAt
```

### `sample_requests`

Stores sample request submissions.

Common fields:

```txt
companyName
website
nameCardImageUrl
phone
email
deliveryAddress
thankYouText
status
createdAt
```

### `site_config/catalog_carousel`

Stores catalog carousel configuration.

### `site_config/catalog_menu`

Stores visual category menu configuration.

Main field:

```txt
highlightedCategories
```

---

## 7. Cloud Functions

Main current functions:

```txt
notifyNewOrder
notifyNewRegistrationRequest
notifyNewSampleRequest
approveRegistrationRequest
disableRegistrationUser
approveRegistrationRequestHttp
disableRegistrationUserHttp
```

### Notifications

Notification functions send emails when documents are created in:

```txt
orders/{orderId}
registration_requests/{requestId}
sample_requests/{requestId}
```

Required secrets:

```txt
SMTP_USER
SMTP_PASSWORD
```

### User approve/disable

Admin actions use HTTP functions behind Firebase Hosting.

Public site routes:

```txt
/api/admin/registration-requests/approve
/api/admin/registration-requests/disable
```

Rewrites in `firebase.json` point to:

```txt
approveRegistrationRequestHttp
disableRegistrationUserHttp
```

These actions validate the logged-in user's Firebase Auth token.

---

## 8. Environment variables

Public Next/Firebase variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_EMAILS=admin@starpro.com,admin@h2hardware.com
```

Notes:

- `NEXT_PUBLIC_*` variables are included in the frontend build;
- changing them requires a new build and hosting deploy;
- function admin emails also need to exist server-side.

Function secrets:

```txt
SMTP_USER
SMTP_PASSWORD
```

---

## 9. Build and deploy

### Install dependencies

```bash
npm install
npm --prefix functions install
```

### Run locally

```bash
npm run dev
```

### Build website

```bash
npm run build
```

### Build functions

```bash
npm --prefix functions run build
```

### Full deploy

```bash
firebase deploy --only hosting,functions --project starpro-web
```

### Hosting-only deploy

Use when changing only frontend, CSS, pages, or public site behavior.

```bash
firebase deploy --only hosting --project starpro-web
```

### Functions-only deploy

Use when changing Cloud Functions, notifications, or approve/disable user actions.

```bash
firebase deploy --only functions --project starpro-web
```

### Specific user action functions deploy

```bash
firebase deploy --only functions:approveRegistrationRequestHttp,functions:disableRegistrationUserHttp,functions:approveRegistrationRequest,functions:disableRegistrationUser --project starpro-web
```

---

## 10. Quick user manual

### Customer buying products

1. Open `/` or `/catalog`.
2. Filter by category/subcategory if needed.
3. Open product.
4. Choose quantity.
5. Add to cart.
6. Check cart counter in the header.
7. Go to `/cart`.
8. Finish through `/checkout`.

### Customer requesting account access

1. Open `/registration-request`.
2. Fill name, email, company, and address.
3. Submit request.
4. Wait for team approval.
5. After approval, use password reset on login to create a password.

### Admin approving user

1. Log in with admin email.
2. Open `/admin/registration-requests`.
3. Find the request.
4. Click **Approve / Create User**.
5. Ask customer to use **Forgot password** on the login page.

### Admin disabling user

1. Open `/admin/registration-requests`.
2. Find approved user.
3. Click **Disable User**.
4. User is blocked in Firebase Auth without deleting history.

### Admin highlighting category

1. Open `/admin/category-highlights`.
2. Select categories.
3. Save.
4. Check highlight in `/` and `/catalog`.

### Admin editing carousel

1. Open `/admin/carousel-builder`.
2. Create or edit slides.
3. Choose link type.
4. Save.
5. Check `/` or `/catalog`.

### Admin editing products

1. Open `/admin/products`.
2. Create or edit product.
3. Confirm `series` as main category.
4. Confirm `category` as subcategory.
5. Save.
6. Check catalog.

---

## 11. Validation checklist

After deploy, validate:

- domain opens correctly;
- catalog loads products;
- category filters work;
- `All in ...` subcategory is not visually displayed;
- category highlights appear on catalog;
- product opens by slug;
- public price appears for non-logged users;
- tiers appear/apply for logged-in users;
- add to cart works;
- cart counter updates;
- checkout creates order;
- admin orders loads;
- sample request submits;
- admin sample requests loads;
- registration request submits;
- admin registration requests loads;
- approve/create user works;
- disable user works;
- notification emails arrive.

---

## 12. Known attention points

### Admin can see the page but cannot approve

Symptom:

```txt
Only admins can perform this action.
```

Likely cause:

- email is allowed in frontend but not in functions;
- functions were not redeployed after changing admin list;
- server-side `ADMIN_EMAILS` variable is not configured.

Fix:

- align `NEXT_PUBLIC_ADMIN_EMAILS`, `ADMIN_EMAILS`, and `DEFAULT_ADMIN_EMAILS`;
- build and deploy functions.

### CORS on approve/disable

The current solution avoids direct calls to `cloudfunctions.net` by using same-origin routes through Firebase Hosting rewrites.

If CORS appears again, check:

- `firebase.json` contains `/api/admin/...` rewrites;
- HTTP functions were deployed;
- frontend calls `/api/admin/...`, not `cloudfunctions.net` directly.

### Changing admins

Changing frontend admin emails requires new hosting build/deploy.

Changing function admin emails requires functions build/deploy.

### Static hosting / prefetch

The site uses Firebase Hosting with static export. Main links use `prefetch={false}` to avoid unnecessary automatic requests that may produce 404s in a static hosting environment.

---

## Final note

This project prioritizes a simple and safe handover. The main goal is to keep the site easy to operate, easy to update, and safe to deploy without unnecessary complexity.
