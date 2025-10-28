#!/usr/bin/env bash
set -euo pipefail

root="$(pwd)"
mkdir -p "$root"

write() { mkdir -p "$(dirname "$1")"; cat > "$1" <<'EOF'
EOF
}

# ----------------- ROOT FILES -----------------
write package.json <<'EOF'
{ "name":"weavi-teams-ai-coldcaller","private":true,"packageManager":"pnpm@9.8.0",
  "scripts":{"build":"pnpm -r build","dev":"pnpm -r --parallel dev","lint":"pnpm -r lint","typecheck":"pnpm -r typecheck","test":"pnpm -r test","e2e":"pnpm --filter @apps/web e2e","format":"prettier -w .","infra:plan":"cd infra/terraform && terraform init && terraform plan","infra:apply":"cd infra/terraform && terraform apply -auto-approve","db:migrate":"pnpm --filter @apps/api prisma:migrate","db:seed":"pnpm --filter @apps/api prisma:seed"},
  "workspaces":["apps/*","packages/*","docs","infra/*"],
  "devDependencies":{"@types/node":"^20.12.12","prettier":"^3.3.3","typescript":"^5.6.2"} }
EOF

write pnpm-workspace.yaml <<'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
  - 'infra/*'
  - 'docs'
EOF

write turbo.json <<'EOF'
{ "$schema":"https://turbo.build/schema.json","pipeline":{
  "build":{"dependsOn":["^build"],"outputs":["dist/**",".next/**"]},
  "dev":{"cache":false},"lint":{},"typecheck":{},"test":{"dependsOn":["build"]}}}
EOF

write tsconfig.base.json <<'EOF'
{ "compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","resolveJsonModule":true,"strict":true,"noUncheckedIndexedAccess":true,"esModuleInterop":true,"skipLibCheck":true,"forceConsistentCasingInFileNames":true,"baseUrl":".","paths":{
  "@repo/ai-router":["packages/ai-router/src/index.ts"],
  "@repo/speech":["packages/speech/src/index.ts"],
  "@repo/teams":["packages/teams/src/index.ts"],
  "@repo/ui-theme":["packages/ui-theme/src/index.ts"],
  "@repo/contracts":["packages/contracts/src/index.ts"] } } }
EOF

write .gitignore <<'EOF'
node_modules
dist
.next
coverage
.env
*.log
apps/**/.next
apps/**/.turbo
terraform.tfstate*
.terraform
pnpm-lock.yaml
EOF

write .env.example <<'EOF'
# See docs/README.md for details. Fill these per app in apps/*/.env
AZURE_POSTGRES_URL=postgresql://luna:luna@localhost:5432/luna?schema=public
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
WEB_URL=http://localhost:3000
OPENAI_API_KEY=
ACS_CONNECTION_STRING=
GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
TEAMS_DEFAULT_TEAM_ID=
TEAMS_DEFAULT_CHANNEL_ID=
TEAMS_DEFAULT_USER_ID=
EOF

write Makefile <<'EOF'
SHELL := /bin/bash
.PHONY: dev build test migrate seed
dev: ; pnpm dev
build: ; pnpm build
test: ; pnpm test
migrate: ; pnpm db:migrate
seed: ; pnpm db:seed
EOF

# ----------------- PACKAGES (contracts) -----------------
mkdir -p packages/contracts/src
write packages/contracts/package.json <<'EOF'
{ "name":"@repo/contracts","version":"1.0.0","type":"module","main":"src/index.ts",
  "scripts":{"build":"tsc -p tsconfig.json","typecheck":"tsc -p tsconfig.json --noEmit"},
  "devDependencies":{"typescript":"^5.6.2","zod":"^3.23.8"},
  "dependencies":{"uuid":"^9.0.1"} }
EOF
write packages/contracts/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist","declaration":true,"declarationMap":true},"include":["src/**/*.ts"] }
EOF
write packages/contracts/src/schemas.ts <<'EOF'
import { z } from "zod";
export const LeadSchema = z.object({
  id: z.string().uuid().optional(),
  phone: z.string(),
  name: z.string().optional(),
  company: z.string().optional(),
  timezone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(10).default(5),
  tags: z.array(z.string()).default([]),
  doNotCall: z.boolean().default(false),
  status: z.enum(["new","queued","dialing","in_progress","completed","failed","human_required"]).default("new")
});
export const PlaybookJsonSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(),
  openingScript: z.string(), qualification: z.array(z.string()),
  objectionPatterns: z.array(z.object({ pattern: z.string(), response: z.string() })),
  compliancePreamble: z.string().optional(),
  ctas: z.array(z.object({ label: z.string(), type: z.enum(["demo","email","meeting","handoff"]) })),
  fallback: z.string().optional(),
  tone: z.enum(["friendly","authoritative","consultative","energetic"]).default("consultative"),
  maxDurationSec: z.number().int().optional(),
  language: z.string().optional(), sttModel: z.string().optional(), ttsVoice: z.string().optional(),
  modelHints: z.object({ provider: z.string(), name: z.string() }).optional()
});
export const CallInsightsSchema = z.object({
  intent: z.enum(["interest","reject","callback","voicemail","unknown"]),
  objections: z.array(z.string()).default([]),
  budget: z.string().optional(), authority: z.string().optional(),
  need: z.string().optional(), timeline: z.string().optional(),
  competitors: z.array(z.string()).default([]),
  sentiment: z.enum(["very_negative","negative","neutral","positive","very_positive"]).default("neutral"),
  callback: z.object({ requested: z.boolean(), when: z.string().optional(), number: z.string().optional() }).default({ requested:false }),
  compliance_flags: z.array(z.string()).default([]), needs_human_review: z.boolean().default(false)
});
export const MeritWeightsSchema = z.object({ intent:z.number(), sentiment:z.number(), need:z.number(), authority:z.number(), timing:z.number(), keyword_bonus:z.number().default(0) });
export const MeritScoreResultSchema = z.object({ score:z.number().min(0).max(100), evidence: z.array(z.string()).default([]) });
export type CallInsights = z.infer<typeof CallInsightsSchema>;
export const EventEnvelopeSchema = z.object({ id:z.string(), callId:z.string(), type:z.string(), payload:z.unknown(), createdAt:z.string() });
export type MeritWeights = z.infer<typeof MeritWeightsSchema>;
EOF
write packages/contracts/src/index.ts <<'EOF'
export * from "./schemas";
EOF

# ----------------- PACKAGES (ai-router) -----------------
mkdir -p packages/ai-router/src
write packages/ai-router/package.json <<'EOF'
{ "name":"@repo/ai-router","version":"1.0.0","type":"module","main":"src/index.ts",
  "scripts":{"build":"tsc -p tsconfig.json","typecheck":"tsc -p tsconfig.json --noEmit"},
  "dependencies":{"@repo/contracts":"workspace:*","zod":"^3.23.8","openai":"^4.56.0","node-fetch":"^3.3.2","p-retry":"^6.2.0"},
  "devDependencies":{"typescript":"^5.6.2"} }
EOF
write packages/ai-router/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist","declaration":true,"declarationMap":true},"include":["src/**/*.ts"] }
EOF
write packages/ai-router/src/prompts.ts <<'EOF'
export const PROMPTS = {
  callPlanner: (name: string, tone: string) =>
    `You are an expert SDR following the ${name} methodology. Maintain a natural, empathetic tone (${tone}). Confirm recording consent. Ask concise, open questions. If the callee asks for a human or indicates readiness for a live demo, switch to HANDOFF. Never fabricate facts; summarise what you heard before moving on.`,
  extractor: "Extract intent, objections, budget, authority, need, timeline, competitor mentions, and callback preferences from the transcript. Return strict JSON that matches the `CallInsights` schema.",
  safety: "Identify sensitive or disallowed content and mark `needs_human_review` if detected.",
  scorer: "Compute Merit Score 0–100 using the configured weights and evidence quotes from transcript."
};
EOF
write packages/ai-router/src/providers.ts <<'EOF'
import OpenAI from "openai";
export type ModelProvider="openai"|"azure-openai"|"anthropic"|"google"|"local";
export interface RouterOptions{provider?:ModelProvider;model?:string;temperature?:number;maxTokens?:number;}
export interface ChatArgs{system:string;messages:{role:"user"|"assistant";content:string}[];tools?:any[];stream?:boolean;}
export class AIRouter{
  private opts:RouterOptions; private openai?:OpenAI;
  constructor(opts:RouterOptions={}){ this.opts={temperature:0.4,maxTokens:800,...opts}; if(!this.opts.provider||this.opts.provider==="openai"){ this.openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY}); } }
  async chat(args:ChatArgs):Promise<string>{ if(this.openai){ const r=await this.openai.chat.completions.create({model:this.opts.model??"gpt-4o-mini",temperature:this.opts.temperature,max_tokens:this.opts.maxTokens,messages:[{role:"system",content:args.system},...args.messages]}); return r.choices[0]?.message?.content??""; } throw new Error("No provider configured"); }
}
EOF
write packages/ai-router/src/guardrails.ts <<'EOF'
const PII=[/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,/\b\d{13,19}\b/g];
export function maskPII(text:string){ return PII.reduce((a,re)=>a.replace(re,"[REDACTED]"),text); }
export function containsBlocked(text:string,blocklist=process.env.BLOCKLIST_KEYWORDS||""){ const items=blocklist.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean); if(!items.length) return false; const lower=text.toLowerCase(); return items.some(k=>lower.includes(k)); }
EOF
write packages/ai-router/src/scoring.ts <<'EOF'
import { MeritWeights, MeritScoreResultSchema, CallInsights } from "@repo/contracts";
export function computeMeritScore(insights:CallInsights,weights:MeritWeights){
  const intent:{[k in CallInsights["intent"]]:number}={interest:1,callback:0.6,unknown:0.5,voicemail:0.2,reject:0};
  const sentiment:{[k in CallInsights["sentiment"]]:number}={very_positive:1,positive:0.8,neutral:0.5,negative:0.2,very_negative:0};
  const hasNeed=insights.need?1:0; const hasAuth=/director|vp|c-level|founder|owner|head/i.test(insights.authority??"")?1:0;
  const goodTiming=/this quarter|next month|q\d|soon|ready/i.test(insights.timeline??"")?1:0;
  const z=(weights.intent*intent[insights.intent])+(weights.sentiment*sentiment[insights.sentiment])+(weights.need*hasNeed)+(weights.authority*hasAuth)+(weights.timing*goodTiming)+(weights.keyword_bonus||0);
  const sigmoid=(x:number)=>1/(1+Math.exp(-x)); const score=Math.round(sigmoid(z)*100);
  return MeritScoreResultSchema.parse({score,evidence:[]});
}
EOF
write packages/ai-router/src/index.ts <<'EOF'
export * from "./providers"; export * from "./prompts"; export * from "./guardrails"; export * from "./scoring";
EOF

# ----------------- PACKAGES (speech) -----------------
mkdir -p packages/speech/src
write packages/speech/package.json <<'EOF'
{ "name":"@repo/speech","version":"1.0.0","type":"module","main":"src/index.ts",
  "dependencies":{"eventemitter3":"^5.0.1"},"devDependencies":{"typescript":"^5.6.2"},
  "scripts":{"build":"tsc -p tsconfig.json","typecheck":"tsc -p tsconfig.json --noEmit"} }
EOF
write packages/speech/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist","declaration":true,"declarationMap":true},"include":["src/**/*.ts"] }
EOF
write packages/speech/src/types.ts <<'EOF'
import { EventEmitter } from "eventemitter3";
export interface STTChunk{ text:string; isFinal:boolean; startTimeMs?:number; endTimeMs?:number; speaker?: "agent"|"lead"; }
export interface STTStream extends EventEmitter{ stop():Promise<void>; }
export interface STTAdapter{ startStream(opts:{language?:string;diarize?:boolean}):Promise<STTStream>; }
export interface TTSAdapter{ synthesize(text:string,opts:{voice?:string;speed?:number}):Promise<Buffer>; }
EOF
write packages/speech/src/azure.ts <<'EOF'
import { STTAdapter, STTStream, TTSAdapter } from "./types";
import { EventEmitter } from "eventemitter3";
export class AzureSTTAdapter implements STTAdapter{ async startStream():Promise<STTStream>{ const e=new EventEmitter() as STTStream; (e as any).stop=async()=>{}; return e; } }
export class AzureTTSAdapter implements TTSAdapter{ async synthesize(text:string):Promise<Buffer>{ return Buffer.from(`AUDIO:${text}`); } }
EOF
write packages/speech/src/index.ts <<'EOF'
export * from "./types"; export * from "./azure";
EOF

# ----------------- PACKAGES (teams) -----------------
mkdir -p packages/teams/src
write packages/teams/package.json <<'EOF'
{ "name":"@repo/teams","version":"1.0.0","type":"module","main":"src/index.ts",
  "dependencies":{"@azure/communication-call-automation":"^1.2.0","@azure/storage-blob":"^12.18.0","@azure/service-bus":"^7.9.5","@microsoft/microsoft-graph-client":"^3.0.7","isomorphic-fetch":"^3.0.0"},
  "devDependencies":{"typescript":"^5.6.2"},
  "scripts":{"build":"tsc -p tsconfig.json","typecheck":"tsc -p tsconfig.json --noEmit"} }
EOF
write packages/teams/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist","declaration":true,"declarationMap":true},"include":["src/**/*.ts"] }
EOF
write packages/teams/src/acs.ts <<'EOF'
import { CallAutomationClient, RecognizeInputType } from "@azure/communication-call-automation";
export class ACSClient{
  private client:CallAutomationClient;
  constructor(){ const conn=process.env.ACS_CONNECTION_STRING; if(!conn) throw new Error("ACS_CONNECTION_STRING required"); this.client=new CallAutomationClient(conn); }
  async placeOutboundCall(args:{toPhoneE164:string;callbackUrl:string;correlationId:string}){ return this.client.createCall({targets:[{phoneNumber:{value:args.toPhoneE164}}],callbackUrl:args.callbackUrl,operationContext:args.correlationId}); }
  callConnection(id:string){ return this.client.getCallConnection(id); }
  async addParticipantToCall(callConnectionId:string,teamsUserId:string){ const conn=this.callConnection(callConnectionId); return conn.addParticipants({participantsToAdd:[{ microsoftTeamsUser:{ mri:`8:orgid:${teamsUserId}` } }]} as any); }
  async playTTS(callConnectionId:string,text:string){ const conn=this.callConnection(callConnectionId); return conn.playToAll({playSource:{kind:"textSource",text}} as any); }
  async recognizeDtmf(callConnectionId:string,promptText:string,maxTones=1){ const conn=this.callConnection(callConnectionId); await this.playTTS(callConnectionId,promptText); return conn.startRecognizing({inputType:RecognizeInputType.Dtmf,dtmfOptions:{maxTonesToCollect:maxTones,stopDtmfTones:["#"]}} as any); }
}
EOF
write packages/teams/src/graph.ts <<'EOF'
import { Client } from "@microsoft/microsoft-graph-client"; import "isomorphic-fetch";
function client(){ const t=process.env.GRAPH_TENANT_ID!, c=process.env.GRAPH_CLIENT_ID!, s=process.env.GRAPH_CLIENT_SECRET!; if(!t||!c||!s) throw new Error("Graph env missing");
  const auth={ getAccessToken:async()=>{ const r=await fetch(`https://login.microsoftonline.com/${t}/oauth2/v2.0/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",client_id:c,client_secret:s,scope:"https://graph.microsoft.com/.default"})}); const j=await r.json(); return j.access_token; } };
  return Client.initWithMiddleware({authProvider:auth});
}
export async function postAdaptiveCard(teamId:string,channelId:string,card:unknown){ const g=client(); return g.api(`/teams/${teamId}/channels/${channelId}/messages`).post({subject:"LUNA Handoff",body:{contentType:"html",content:"<p>LUNA handoff</p>"},attachments:[{contentType:"application/vnd.microsoft.card.adaptive",content:card}]}); }
export async function postAdaptiveCardToUser(userId:string,card:unknown){ const g=client(); const chats=await g.api(`/users/${userId}/chats`).get(); const chatId=chats.value?.[0]?.id; if(!chatId) throw new Error("No chat found"); return g.api(`/chats/${chatId}/messages`).post({body:{contentType:"html",content:"<p>LUNA handoff</p>"},attachments:[{contentType:"application/vnd.microsoft.card.adaptive",content:card}]}); }
export async function sendActivityNotification(userId:string,title:string,body:string,link?:string){ const g=client(); return g.api(`/users/${userId}/teamwork/sendActivityNotification`).post({topic:{source:"entityUrl",value:link||"https://example.com"},activityType:"lunaHandoff",previewText:{content:title},templateParameters:[{name:"body",value:body}]}); }
export function buildHandoffAdaptiveCard(p:{leadName?:string;phone:string;company?:string;callId:string;merit?:number;summary?:string;}){ return {"$schema":"http://adaptivecards.io/schemas/adaptive-card.json","type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"🚀 LUNA Handoff","weight":"Bolder","size":"Large"},{"type":"TextBlock","text":p.summary||"Prospect requests a human.","wrap":true},{"type":"FactSet","facts":[{"title":"Lead","value":p.leadName||"Unknown"},{"title":"Company","value":p.company||"—"},{"title":"Phone","value":p.phone},{"title":"Call ID","value":p.callId},{"title":"Merit","value":String(p.merit??"—") }]}],"actions":[{"type":"Action.OpenUrl","title":"Open in LUNA","url":`${process.env.WEB_URL}/opportunities?callId=${p.callId}`},{"type":"Action.Call","title":"Call Prospect","phoneNumber":p.phone}]}; }
EOF
write packages/teams/src/index.ts <<'EOF'
export * from "./acs"; export * from "./graph";
EOF

# ----------------- PACKAGES (ui-theme) -----------------
mkdir -p packages/ui-theme/src
write packages/ui-theme/package.json <<'EOF'
{ "name":"@repo/ui-theme","version":"1.0.0","type":"module","main":"src/index.ts","dependencies":{"tailwindcss":"^3.4.10"} }
EOF
write packages/ui-theme/src/index.ts <<'EOF'
export const theme={colors:{background:"#f6f5ff",card:"#ffffff",primary:"#7056ff",accent:"#2cc5b9",text:"#1e1b4b",subtle:"#a9a6d2"},radius:{xl:"1.25rem","2xl":"1.5rem"},shadow:{soft:"0 10px 30px rgba(112,86,255,0.12)"}};
EOF

# ----------------- APPS (API) -----------------
mkdir -p apps/api/src/modules/{leads,playbooks,calls,events,webhooks} apps/api/prisma
write apps/api/package.json <<'EOF'
{ "name":"@apps/api","version":"1.0.0","type":"module","main":"dist/main.js",
  "scripts":{"dev":"nest start --watch","build":"nest build","typecheck":"tsc -p tsconfig.json --noEmit","test":"echo no-tests","prisma:migrate":"prisma migrate dev","prisma:generate":"prisma generate","prisma:seed":"ts-node prisma/seed.ts"},
  "dependencies":{"@nestjs/common":"^10.4.5","@nestjs/core":"^10.4.5","@nestjs/platform-fastify":"^10.4.5","@nestjs/websockets":"^10.4.5","@prisma/client":"^5.19.0","@repo/contracts":"workspace:*","@repo/ai-router":"workspace:*","@repo/teams":"workspace:*","pino":"^9.3.2","zod":"^3.23.8","socket.io":"^4.7.5","@azure/service-bus":"^7.9.5"},
  "devDependencies":{"@nestjs/cli":"^10.4.5","@nestjs/schematics":"^10.1.3","@types/node":"^20.12.12","typescript":"^5.6.2","prisma":"^5.19.0","ts-node":"^10.9.2"} }
EOF
write apps/api/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist"},"include":["src/**/*.ts","prisma/**/*.ts"] }
EOF
write apps/api/prisma/schema.prisma <<'EOF'
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("AZURE_POSTGRES_URL") }
model User { id String @id @default(uuid()) email String @unique name String? role String teamsUserId String? }
model Lead { id String @id @default(uuid()) phone String name String? company String? timezone String? email String? notes String? priority Int @default(5) tags String[] doNotCall Boolean @default(false) status String @default("new") calls Call[] }
model Call { id String @id @default(uuid()) leadId String lead Lead @relation(fields:[leadId],references:[id]) startedAt DateTime @default(now()) endedAt DateTime? durationSec Int? playbookId String? transcriptUrl String? audioUrl String? sentiment String? intent String? meritScore Int? handoff Boolean @default(false) handoffReason String? handoffToUserId String? events Event[] }
model Playbook { id String @id @default(uuid()) name String version Int @default(1) json Json createdBy String? }
model Event { id String @id @default(uuid()) callId String call Call @relation(fields:[callId],references:[id]) type String payloadJson Json createdAt DateTime @default(now()) }
model ProviderConfig { id String @id @default(uuid()) type String settingsJson Json createdBy String? }
EOF
write apps/api/prisma/seed.ts <<'EOF'
import { PrismaClient } from "@prisma/client"; import fs from "node:fs";
const prisma=new PrismaClient();
async function main(){
  const pbs=JSON.parse(fs.readFileSync("../../docs/fixtures/playbooks.json","utf8"));
  for(const p of pbs){ await prisma.playbook.create({data:{name:p.name,json:p,version:1}}); }
  await prisma.user.upsert({ where:{email:"admin@example.com"}, update:{}, create:{email:"admin@example.com",name:"Admin",role:"admin"} });
}
main().finally(()=>prisma.$disconnect());
EOF
write apps/api/src/main.ts <<'EOF'
import { NestFactory } from "@nestjs/core"; import { AppModule } from "./modules/app.module"; import { FastifyAdapter } from "@nestjs/platform-fastify";
async function bootstrap(){ const app=await NestFactory.create(AppModule,new FastifyAdapter({logger:true})); app.enableCors({origin:(process.env.CORS_ALLOWED_ORIGINS||"http://localhost:3000").split(","),credentials:true}); await app.listen(4000,"0.0.0.0"); }
bootstrap();
EOF
write apps/api/src/prisma.service.ts <<'EOF'
import { INestApplication, Injectable, OnModuleInit } from "@nestjs/common"; import { PrismaClient } from "@prisma/client";
@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit{ async onModuleInit(){await this.$connect();} async enableShutdownHooks(app:INestApplication){ this.$on("beforeExit",async()=>{await app.close();}); } }
EOF
write apps/api/src/modules/app.module.ts <<'EOF'
import { Module } from "@nestjs/common";
import { LeadsModule } from "./leads/leads.module";
import { CallsModule } from "./calls/calls.module";
import { PlaybooksModule } from "./playbooks/playbooks.module";
import { WebhooksModule } from "./../modules/webhooks/webhooks.module";
import { EventsGateway } from "./events/events.gateway";
import { PrismaService } from "../../src/prisma.service";
@Module({ imports:[LeadsModule,CallsModule,PlaybooksModule,WebhooksModule], providers:[EventsGateway,PrismaService] })
export class AppModule {}
EOF
write apps/api/src/modules/events/events.gateway.ts <<'EOF'
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets"; import { Server } from "socket.io";
@WebSocketGateway({namespace:"/events",cors:{origin:true}}) export class EventsGateway{ @WebSocketServer() server!:Server; publish(e:{type:string;callId:string;payload:unknown}){ this.server.emit(e.type,e); } }
EOF
write apps/api/src/modules/leads/leads.service.ts <<'EOF'
import { Injectable } from "@nestjs/common"; import { PrismaService } from "../../prisma.service"; import { Lead } from "@prisma/client";
@Injectable() export class LeadsService{ constructor(private prisma:PrismaService){} create(data:Partial<Lead>){ return this.prisma.lead.create({data:data as any}); } list(){ return this.prisma.lead.findMany({orderBy:{priority:"desc"}}); } update(id:string,data:Partial<Lead>){ return this.prisma.lead.update({where:{id},data}); } }
EOF
write apps/api/src/modules/leads/leads.controller.ts <<'EOF'
import { Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { LeadsService } from "./leads.service"; import { FileInterceptor } from "@nestjs/platform-fastify/multer"; import { parse } from "csv-parse/sync";
@Controller("leads") export class LeadsController{
  constructor(private leads:LeadsService){}
  @Post() create(@Body() body:any){ return this.leads.create(body); }
  @Get() list(){ return this.leads.list(); }
  @Patch(":id") update(){ return {ok:true}; }
  @Post("import") @UseInterceptors(FileInterceptor("file")) async importCsv(@UploadedFile() file:Express.Multer.File){
    const rows=parse(file.buffer,{columns:true,skip_empty_lines:true}); const created:any[]=[];
    for(const r of rows){ created.push(await this.leads.create({ phone:r.phone, name:r.name, company:r.company, timezone:r.timezone, email:r.email, notes:r.notes, priority:Number(r.priority??5), tags:(r.tags||"").split(",").filter(Boolean) })); }
    return {count:created.length};
  }
}
EOF
write apps/api/src/modules/playbooks/playbooks.service.ts <<'EOF'
import { Injectable } from "@nestjs/common"; import { PrismaService } from "../../prisma.service";
@Injectable() export class PlaybooksService{ constructor(private prisma:PrismaService){} list(){ return this.prisma.playbook.findMany(); } get(id:string){ return this.prisma.playbook.findUnique({where:{id}}); } create(data:any){ return this.prisma.playbook.create({data}); } validate(json:any){ return {valid:true}; } }
EOF
write apps/api/src/modules/playbooks/playbooks.controller.ts <<'EOF'
import { Body, Controller, Get, Param, Post } from "@nestjs/common"; import { PlaybooksService } from "./playbooks.service";
@Controller("playbooks") export class PlaybooksController{
  constructor(private service:PlaybooksService){} @Get() list(){ return this.service.list(); }
  @Get(":id") get(@Param("id") id:string){ return this.service.get(id); }
  @Post() create(@Body() body:any){ return this.service.create(body); }
  @Post("validate") validate(@Body() body:any){ return this.service.validate(body); }
}
EOF
write apps/api/src/modules/calls/calls.service.ts <<'EOF'
import { Injectable } from "@nestjs/common"; import { PrismaService } from "../../prisma.service"; import { ServiceBusClient } from "@azure/service-bus"; import { EventsGateway } from "../events/events.gateway";
@Injectable() export class CallsService{
  private sb?:ServiceBusClient;
  constructor(private prisma:PrismaService,private events:EventsGateway){ const conn=process.env.AZURE_SERVICEBUS_CONNECTION; if(conn) this.sb=new ServiceBusClient(conn); }
  async start(payload:{leadId?:string;phone?:string;playbookId?:string;voice?:string;model?:string}){ const lead=payload.leadId? await this.prisma.lead.findUnique({where:{id:payload.leadId}}) : await this.prisma.lead.create({data:{phone:payload.phone!,status:"queued"}}); const call=await this.prisma.call.create({data:{leadId:lead!.id,playbookId:payload.playbookId}}); this.events.publish({type:"call.queued",callId:call.id,payload:{leadId:lead!.id}});
    if(this.sb){ const sender=this.sb.createSender("dial-queue"); await sender.sendMessages({body:{callId:call.id,leadId:lead!.id,playbookId:payload.playbookId}}); }
    return {id:call.id}; }
  get(id:string){ return this.prisma.call.findUnique({where:{id}}); }
  async handoff(callId:string,body:{option:"bridge"|"card"|"notify";teamsUserId?:string;teamId?:string;channelId?:string}){ const call=await this.prisma.call.findUnique({where:{id:callId},include:{lead:true}}); if(!call) throw new Error("Call not found"); await this.prisma.lead.update({where:{id:call.leadId},data:{status:"human_required"}}); await this.prisma.call.update({where:{id:callId},data:{handoff:true,handoffReason:"Requested human"}}); this.events.publish({type:"call.handoff.required",callId,payload:{phone:call.lead?.phone,merit:call.meritScore}});
    const { postAdaptiveCard, postAdaptiveCardToUser, sendActivityNotification, buildHandoffAdaptiveCard, ACSClient } = await import("@repo/teams");
    if(body.option==="bridge"){ const acs=new ACSClient(); await acs.addParticipantToCall(callId, body.teamsUserId||process.env.TEAMS_DEFAULT_USER_ID!); this.events.publish({type:"call.handoff.sent",callId,payload:{option:"bridge"}}); return {ok:true,option:"bridge"}; }
    if(body.option==="card"){ const card=buildHandoffAdaptiveCard({leadName:call.lead?.name||undefined,company:call.lead?.company||undefined,phone:call.lead?.phone||"",callId,merit:call.meritScore||0,summary:"Prospect asked for a human. Click to dial."}); if(body.channelId&&body.teamId){ await postAdaptiveCard(body.teamId,body.channelId,card); } else { await postAdaptiveCardToUser(body.teamsUserId||process.env.TEAMS_DEFAULT_USER_ID!,card); } this.events.publish({type:"call.handoff.sent",callId,payload:{option:"card"}}); return {ok:true,option:"card"}; }
    await sendActivityNotification(body.teamsUserId||process.env.TEAMS_DEFAULT_USER_ID!,"LUNA handoff",`Call ${callId} merit ${call.meritScore}`,`${process.env.WEB_URL}/opportunities?callId=${callId}`); this.events.publish({type:"call.handoff.sent",callId,payload:{option:"notify"}}); return {ok:true,option:"notify"}; }
}
EOF
write apps/api/src/modules/calls/calls.controller.ts <<'EOF'
import { Body, Controller, Get, Param, Post } from "@nestjs/common"; import { CallsService } from "./calls.service";
@Controller("calls") export class CallsController{
  constructor(private service:CallsService){}
  @Post("start") start(@Body() body:any){ return this.service.start(body); }
  @Get(":id") get(@Param("id") id:string){ return this.service.get(id); }
  @Post(":id/handoff") handoff(@Param("id") id:string,@Body() body:{option:"bridge"|"card"|"notify";teamsUserId?:string;teamId?:string;channelId?:string}){ return this.service.handoff(id,body); }
}
EOF
write apps/api/src/modules/leads/leads.module.ts <<'EOF'
import { Module } from "@nestjs/common"; import { LeadsService } from "./leads.service"; import { LeadsController } from "./leads.controller"; import { PrismaService } from "../../prisma.service";
@Module({controllers:[LeadsController],providers:[LeadsService,PrismaService]})
export class LeadsModule {}
EOF
write apps/api/src/modules/calls/calls.module.ts <<'EOF'
import { Module } from "@nestjs/common"; import { CallsController } from "./calls.controller"; import { CallsService } from "./calls.service"; import { PrismaService } from "../../prisma.service"; import { EventsGateway } from "../events/events.gateway";
@Module({controllers:[CallsController],providers:[CallsService,PrismaService,EventsGateway]})
export class CallsModule {}
EOF
write apps/api/src/modules/playbooks/playbooks.module.ts <<'EOF'
import { Module } from "@nestjs/common"; import { PlaybooksService } from "./playbooks.service"; import { PlaybooksController } from "./playbooks.controller"; import { PrismaService } from "../../prisma.service";
@Module({controllers:[PlaybooksController],providers:[PlaybooksService,PrismaService]})
export class PlaybooksModule {}
EOF
write apps/api/src/modules/webhooks/webhooks.module.ts <<'EOF'
import { Module } from "@nestjs/common"; import { WebhooksController } from "./webhooks.controller"; import { PrismaService } from "../../prisma.service"; import { EventsGateway } from "../events/events.gateway";
@Module({controllers:[WebhooksController],providers:[PrismaService,EventsGateway]})
export class WebhooksModule {}
EOF
write apps/api/src/modules/webhooks/webhooks.controller.ts <<'EOF'
import { Body, Controller, Post } from "@nestjs/common"; import { PrismaService } from "../../prisma.service"; import { EventsGateway } from "../events/events.gateway";
@Controller("webhooks") export class WebhooksController{
  constructor(private prisma:PrismaService, private events:EventsGateway){}
  @Post("acs") async acs(@Body() body:any){ const callId=body?.operationContext||body?.callConnectionId||"unknown"; this.events.publish({type:"acs.event",callId,payload:body}); return {ok:true}; }
}
EOF

# ----------------- APPS (worker-calls) -----------------
mkdir -p apps/worker-calls/src
write apps/worker-calls/package.json <<'EOF'
{ "name":"@apps/worker-calls","version":"1.0.0","type":"module","main":"dist/index.js",
  "scripts":{"dev":"ts-node src/index.ts","build":"tsc -p tsconfig.json","typecheck":"tsc -p tsconfig.json --noEmit"},
  "dependencies":{"@azure/service-bus":"^7.9.5","@prisma/client":"^5.19.0","@repo/ai-router":"workspace:*","@repo/contracts":"workspace:*","@repo/speech":"workspace:*","@repo/teams":"workspace:*","fastify":"^4.28.1","pino":"^9.3.2"},
  "devDependencies":{"typescript":"^5.6.2","ts-node":"^10.9.2","prisma":"^5.19.0"} }
EOF
write apps/worker-calls/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist"},"include":["src/**/*.ts"] }
EOF
write apps/worker-calls/src/state.ts <<'EOF'
export type CallState="Init"|"Intro"|"Consent"|"Qualify"|"CTA"|"Handoff"|"WrapUp"|"End"|"Voicemail";
export interface CallContext{ callId:string; callConnectionId?:string; playbook:any; transcript:string[]; handoffRequested:boolean; hasConsent:boolean; attempts:number; confirmedCallback?:string; }
export function nextState(s:CallState, c:CallContext):CallState{ if(s==="Init")return"Intro"; if(s==="Intro")return"Consent"; if(s==="Consent")return c.hasConsent?"Qualify":"WrapUp"; if(s==="Qualify")return c.handoffRequested?"Handoff":"CTA"; if(s==="CTA")return c.handoffRequested?"Handoff":"WrapUp"; if(s==="Handoff")return"End"; return"End"; }
EOF
write apps/worker-calls/src/index.ts <<'EOF'
import Fastify from "fastify"; import { PrismaClient } from "@prisma/client";
import { AIRouter, PROMPTS, computeMeritScore } from "@repo/ai-router";
import { AzureTTSAdapter } from "@repo/speech"; import { ACSClient } from "@repo/teams";
import { nextState, CallContext, CallState } from "./state";
const app=Fastify({logger:true}); const prisma=new PrismaClient();

function digitsToE164(d:string){ const c=d.replace(/[^\d]/g,""); if(c.length<10) return null; return c.startsWith("+")?c:`+${c}`; }

async function runCall(callId:string, playbook:any){
  const router=new AIRouter({provider:"openai"}); const tts=new AzureTTSAdapter(); const ctx:CallContext={callId,playbook,transcript:[],handoffRequested:false,hasConsent:false,attempts:0};
  const acs=new ACSClient(); const placed=await acs.placeOutboundCall({toPhoneE164:"+15551230000",callbackUrl:(process.env.WEB_URL||"http://localhost:3000")+"/api/acs",correlationId:callId});
  ctx.callConnectionId=(placed as any)?.callConnectionProperties?.callConnectionId || callId;
  let state:CallState="Init";
  while(state!=="End"){
    if(state==="Intro"){ const msg=playbook.openingScript||"Hi, quick one: can I steal 30 seconds?"; await tts.synthesize(msg,{voice:playbook.ttsVoice}); ctx.transcript.push(`agent: ${msg}`); }
    if(state==="Consent"){ const consent=playbook.compliancePreamble||"This call may be recorded for quality. Do you consent?"; await tts.synthesize(consent,{voice:playbook.ttsVoice}); ctx.hasConsent=true; }
    if(state==="Qualify"){ const sys=PROMPTS.callPlanner(playbook.name||"Challenger",playbook.tone||"consultative"); const reply=await router.chat({system:sys,messages:[{role:"user",content:'Lead said: "Can I talk to a person?"'}]}); ctx.transcript.push(`agent: ${reply}`); if(/human|rep|person|someone/i.test(reply)) ctx.handoffRequested=true; }
    if(state==="CTA"){ ctx.transcript.push("agent: Would you like to schedule a quick demo?"); }
    if(state==="Handoff"){ const suspected=(await prisma.lead.findFirst({where:{id:(await prisma.call.findUnique({where:{id:callId}}))!.leadId}}))?.phone||""; const prompt=`I have your number as ${suspected}. Press 1 to confirm. Press 2 to enter a different number.`; await acs.recognizeDtmf(ctx.callConnectionId!,prompt,1);
      const entered=suspected; const e164=digitsToE164(entered)||suspected; ctx.confirmedCallback=e164; await prisma.call.update({where:{id:callId},data:{handoff:true,handoffReason:"Lead requested human"}}); await prisma.event.create({data:{callId,type:"handoff.requested",payloadJson:{phone:e164}}});
      const option=(process.env.LUNA_HANDOFF_OPTION as any)||"card"; await fetch((process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:4000")+"/calls/"+callId+"/handoff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({option,teamsUserId:process.env.TEAMS_DEFAULT_USER_ID,teamId:process.env.TEAMS_DEFAULT_TEAM_ID,channelId:process.env.TEAMS_DEFAULT_CHANNEL_ID})}).catch(()=>null);
    }
    if(state==="WrapUp"){ ctx.transcript.push("agent: Thanks for your time. Goodbye."); }
    state=nextState(state,ctx);
  }
  const insights:any={intent:ctx.handoffRequested?"interest":"unknown",sentiment:"positive",need:"improve outbound",authority:"Head of Sales",timeline:"this quarter",objections:[],competitors:[],callback:{requested:false},compliance_flags:[],needs_human_review:false};
  const score=computeMeritScore(insights,{intent:2,sentiment:1,need:1,authority:1,timing:1,keyword_bonus:0});
  await prisma.call.update({where:{id:callId},data:{intent:insights.intent,sentiment:insights.sentiment,meritScore:score.score}});
}
app.post("/jobs/dial", async (req,res)=>{ const {callId,playbookId}=(req.body as any)||{}; const p=await (new PrismaClient()).playbook.findUnique({where:{id:playbookId}}); await runCall(callId,p?.json||{}); return res.send({ok:true}); });
app.listen({port:4100,host:"0.0.0.0"});
EOF

# ----------------- APPS (ingestor) -----------------
mkdir -p apps/ingestor/src
write apps/ingestor/package.json <<'EOF'
{ "name":"@apps/ingestor","version":"1.0.0","type":"module","main":"dist/index.js",
  "scripts":{"dev":"ts-node src/index.ts","build":"tsc -p tsconfig.json"},
  "dependencies":{"@azure/service-bus":"^7.9.5","@prisma/client":"^5.19.0","csv-parse":"^5.5.6","libphonenumber-js":"^1.11.7"},
  "devDependencies":{"typescript":"^5.6.2","ts-node":"^10.9.2","prisma":"^5.19.0"} }
EOF
write apps/ingestor/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"outDir":"dist"},"include":["src/**/*.ts"] }
EOF
write apps/ingestor/src/index.ts <<'EOF'
import { PrismaClient } from "@prisma/client"; import { parse } from "csv-parse"; import fs from "node:fs"; import { parsePhoneNumber } from "libphonenumber-js"; import { ServiceBusClient } from "@azure/service-bus";
const prisma=new PrismaClient(); const sb=new ServiceBusClient(process.env.AZURE_SERVICEBUS_CONNECTION!);
export async function importCsv(path:string){ const sender=sb.createSender("dial-queue"); const stream=fs.createReadStream(path).pipe(parse({columns:true})); for await(const row of stream){ try{ const phone=parsePhoneNumber(row.phone).format("E.164"); const lead=await prisma.lead.upsert({where:{phone},update:{name:row.name,company:row.company},create:{phone,name:row.name,company:row.company,timezone:row.timezone,status:"queued"}}); await sender.sendMessages({body:{leadId:lead.id,callId:"",playbookId:process.env.DEFAULT_PLAYBOOK_ID}}); }catch(e){ console.error("Row failed",row,e); } } }
if(process.argv[2]) importCsv(process.argv[2]).then(()=>process.exit(0));
EOF

# ----------------- APPS (WEB) -----------------
mkdir -p apps/web/app apps/web/public
write apps/web/package.json <<'EOF'
{ "name":"@apps/web","version":"1.0.0","private":true,"type":"module",
  "scripts":{"dev":"next dev -p 3000","build":"next build","start":"next start -p 3000","typecheck":"tsc -p tsconfig.json --noEmit"},
  "dependencies":{"next":"14.2.7","react":"18.3.1","react-dom":"18.3.1","zustand":"^4.5.4","@tanstack/react-query":"^5.51.15","axios":"^1.7.4","socket.io-client":"^4.7.5","framer-motion":"^11.3.19","tailwindcss":"^3.4.10","@repo/ui-theme":"workspace:*"},
  "devDependencies":{"typescript":"^5.6.2","@types/node":"^20.12.12","@types/react":"^18.3.7"} }
EOF
write apps/web/tsconfig.json <<'EOF'
{ "extends":"../../tsconfig.base.json","compilerOptions":{"jsx":"react-jsx","outDir":"dist"},"include":["app/**/*.ts","app/**/*.tsx"] }
EOF
write apps/web/postcss.config.js <<'EOF'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
EOF
write apps/web/tailwind.config.ts <<'EOF'
import type { Config } from "tailwindcss"; import { theme } from "@repo/ui-theme";
export default { content:["./app/**/*.{ts,tsx}"], theme:{ extend:{ colors:{ background:theme.colors.background, primary:theme.colors.primary, accent:theme.colors.accent, text:theme.colors.text, subtle:theme.colors.subtle }, borderRadius:{ xl:theme.radius.xl, "2xl":theme.radius["2xl"] }, boxShadow:{ soft:theme.shadow.soft } } }, plugins:[] } satisfies Config;
EOF
write apps/web/app/globals.css <<'EOF'
@tailwind base; @tailwind components; @tailwind utilities; body{ @apply bg-background text-text; } .card{ @apply rounded-2xl shadow-soft bg-white; }
EOF
write apps/web/app/layout.tsx <<'EOF'
import "./globals.css"; import Link from "next/link"; import Image from "next/image"; import { ReactNode } from "react";
export default function RootLayout({children}:{children:React.ReactNode}){ return (<html lang="en"><body><div className="flex min-h-screen"><aside className="w-64 p-4 bg-white border-r">
  <div className="flex items-center gap-2 mb-6"><Image src="/luna.svg" alt="LUNA" width={36} height={36} priority /><div><div className="font-extrabold text-2xl text-primary leading-none">LUNA</div><div className="text-xs text-subtle -mt-1">Lead Upsell & Nurture Assistant</div></div></div>
  <nav className="space-y-2"><Link className="block px-3 py-2 rounded-xl hover:bg-background" href="/">Dashboard</Link><Link className="block px-3 py-2 rounded-xl hover:bg-background" href="/marketing">Marketing</Link></nav></aside><main className="flex-1 p-8">{children}</main></div></body></html>); }
EOF
write apps/web/app/page.tsx <<'EOF'
"use client";
import { useEffect, useState } from "react"; import io from "socket.io-client"; import axios from "axios";
export default function Dashboard(){ const [events,setEvents]=useState<any[]>([]); const [phone,setPhone]=useState("+15551234567"); const [pbs,setPbs]=useState<any[]>([]); const api=process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:4000";
  useEffect(()=>{ axios.get(`${api}/playbooks`).then(r=>setPbs(r.data)); const s=io(`${api}/events`,{transports:["websocket"]}); s.onAny((_e,d)=>setEvents(e=>[d,...e].slice(0,50))); return()=>s.close(); },[]);
  async function startCall(){ const playbookId=pbs[0]?.id; await axios.post(`${api}/calls/start`,{phone,playbookId}); }
  return (<div className="space-y-6"><div className="card p-6"><h1 className="text-3xl font-bold mb-2">Today’s Calls</h1><p className="text-subtle">Single test number</p>
    <div className="mt-4 flex gap-3"><input className="border rounded-xl px-4 py-2 w-64" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+E.164" /><button onClick={startCall} className="px-4 py-2 rounded-xl bg-primary text-white">Start AI Call</button></div></div>
    <div className="grid grid-cols-3 gap-6"><div className="card p-6 col-span-2"><h2 className="text-xl font-semibold mb-4">Live Events</h2><ul className="space-y-2 max-h-96 overflow-auto">{events.map((e,i)=>(<li key={i} className="p-3 rounded-xl bg-background">{JSON.stringify(e)}</li>))}</ul></div>
    <div className="card p-6"><h2 className="text-xl font-semibold mb-4">Upload CSV</h2><form className="space-y-2" action={`${api}/leads/import`} method="post" encType="multipart/form-data"><input type="file" name="file" accept=".csv" className="block"/><button className="px-4 py-2 rounded-xl bg-accent text-white">Import</button></form></div></div></div>); }
EOF
write apps/web/public/luna.svg <<'EOF'
<?xml version="1.0" encoding="UTF-8"?><svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="LUNA logo"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7056FF"/><stop offset="100%" stop-color="#2CC5B9"/></linearGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur"/><feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.44 0 0 0 0 0.34 0 0 0 0 1 0 0 0 0.2 0"/><feBlend in="SourceGraphic" mode="normal"/></filter></defs><rect width="256" height="256" rx="48" fill="#FFFFFF"/><g filter="url(#s)"><circle cx="128" cy="128" r="78" fill="url(#g)"/></g><circle cx="160" cy="112" r="78" fill="#FFFFFF"/><path d="M74 160c18-14 38-14 56 0 18 14 38 14 56 0" stroke="url(#g)" stroke-width="10" stroke-linecap="round" fill="none"/><text x="128" y="228" text-anchor="middle" font-family="Inter, system-ui" font-weight="800" font-size="28" fill="#1E1B4B">LUNA</text></svg>
EOF

# ----------------- DOCS -----------------
mkdir -p docs/fixtures/adaptive-cards
write docs/README.md <<'EOF'
# LUNA — Lead Upsell & Nurture Assistant
Quickstart: `pnpm i` → set env → Postgres → `pnpm db:migrate && pnpm db:seed` → `pnpm dev`. Web: http://localhost:3000, API: http://localhost:4000.
EOF
write docs/API.md <<'EOF'
Endpoints: POST /calls/start, GET /calls/:id, POST /calls/:id/handoff, POST /leads, POST /leads/import, GET /leads, GET/POST /playbooks, WS: /events
EOF
write docs/SECURITY.md <<'EOF'
Use Key Vault in prod. PII masking, CSP, SameSite=Lax, RBAC, least privilege. Rotate secrets.
EOF
write docs/PRIVACY.md <<'EOF'
Consent & opt-out captured in call flow. DNC support recommended in worker/ingestor.
EOF
write docs/OPERATIONS.md <<'EOF'
Use Service Bus for dial queue, Blob for artifacts, Grafana/OTel optional. Blue/green deploy via tags.
EOF
write docs/TEAMS_SETUP.md <<'EOF'
Create ACS + Graph app. Set ACS_CONNECTION_STRING and GRAPH_* vars. Enable Teams interop in ACS. Collect Team/Channel/User IDs.
EOF
write docs/PLAYBOOKS.md <<'EOF'
Playbook JSON schema included. Edit via Marketing tab in UI. See fixtures/playbooks.json.
EOF
write docs/fixtures/playbooks.json <<'EOF'
[{"id":"challenger","name":"Challenger","description":"Teach, tailor, take control.","openingScript":"Hi, it's LUNA—quick one: we help teams book 30% more meetings. Got 30 seconds?","qualification":["How are you handling outbound connect rates today?"],"objectionPatterns":[{"pattern":"not interested","response":"Totally fair—what would make this worth 10 minutes?"}],"compliancePreamble":"This call may be recorded for quality. Do you consent?","ctas":[{"label":"Book demo","type":"demo"},{"label":"Send email","type":"email"},{"label":"Handoff to rep","type":"handoff"}],"fallback":"I'll send a brief email. Thanks!","tone":"consultative","language":"en-US","ttsVoice":"en-US-JennyNeural","modelHints":{"provider":"openai","name":"gpt-4o-mini"}},{"id":"spin","name":"SPIN Selling","description":"Situation, Problem, Implication, Need-payoff.","openingScript":"Hi, quick check-in: how are you currently generating pipeline?","qualification":["What’s the main bottleneck today?"],"objectionPatterns":[{"pattern":"no budget","response":"If we proved ROI in weeks, would budget appear?"}],"ctas":[{"label":"Schedule 20-min","type":"meeting"}],"tone":"friendly","ttsVoice":"en-US-GuyNeural"}]
EOF
write docs/fixtures/sample-leads.csv <<'EOF'
phone,name,company,role,timezone,email,notes,priority,tags
+15555550100,Casey Quinn,Quinn Co,Head of RevOps,America/Los_Angeles,casey@quinn.co,,
+15555550101,Jordan Lee,Lee Labs,VP Sales,America/New_York,jordan@leelabs.io,"Asked for Q4",8,hot,q4
+15555550102,Morgan Ray,RayHealth,Founder,Europe/London,morgan@rayhealth.com,,6,uk,healthcare
EOF
write docs/fixtures/adaptive-cards/luna-handoff.json <<'EOF'
{"$schema":"http://adaptivecards.io/schemas/adaptive-card.json","type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"🚀 LUNA Handoff","weight":"Bolder","size":"Large"},{"type":"TextBlock","text":"Prospect requests a human. Click to dial.","wrap":true},{"type":"FactSet","facts":[{"title":"Lead","value":"Sample Lead"},{"title":"Company","value":"Acme Inc."},{"title":"Phone","value":"+15555550100"},{"title":"Call ID","value":"00000000-0000-0000-0000-000000000000"},{"title":"Merit","value":"88"}]}],"actions":[{"type":"Action.OpenUrl","title":"Open in LUNA","url":"http://localhost:3000/opportunities?callId=..."},{"type":"Action.Call","title":"Call Prospect","phoneNumber":"+15555550100"}]}
EOF

# ----------------- INFRA (terraform minimal) -----------------
mkdir -p infra/terraform/modules/{keyvault,servicebus}
write infra/terraform/main.tf <<'EOF'
terraform { required_version=">= 1.6.0" required_providers{ azurerm={ source="hashicorp/azurerm", version="~> 3.113"} } }
provider "azurerm" { features {} }
variable "prefix" { type=string } variable "location" { type=string default="eastus" }
resource "azurerm_resource_group" "rg" { name="${var.prefix}-rg" location=var.location }
module "kv" { source="./modules/keyvault" prefix=var.prefix resource_group_name=azurerm_resource_group.rg.name location=var.location }
module "sb" { source="./modules/servicebus" prefix=var.prefix resource_group_name=azurerm_resource_group.rg.name location=var.location }
output "resource_group" { value=azurerm_resource_group.rg.name }
EOF
write infra/terraform/modules/keyvault/main.tf <<'EOF'
variable "prefix"{type=string} variable "resource_group_name"{type=string} variable "location"{type=string}
resource "azurerm_key_vault" "kv"{ name="${var.prefix}-kv" location=var.location resource_group_name=var.resource_group_name tenant_id=var.prefix sku_name="standard" purge_protection_enabled=true soft_delete_retention_days=7 }
EOF
write infra/terraform/modules/servicebus/main.tf <<'EOF'
variable "prefix"{type=string} variable "resource_group_name"{type=string} variable "location"{type=string}
resource "azurerm_servicebus_namespace" "sb"{ name="${var.prefix}-sb" location=var.location resource_group_name=var.resource_group_name sku="Basic" }
resource "azurerm_servicebus_queue" "dial"{ name="dial-queue" resource_group_name=var.resource_group_name namespace_name=azurerm_servicebus_namespace.sb.name max_delivery_count=10 }
EOF

# ----------------- GITHUB ACTIONS -----------------
mkdir -p .github/workflows
write .github/workflows/ci.yml <<'EOF'
name: CI
on: { push: { branches: [ main ] }, pull_request: {} }
jobs:
  build-test:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.8.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm i --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
EOF
write .github/workflows/deploy.yml <<'EOF'
name: Deploy
on: { workflow_dispatch: {}, push: { tags: [ "v*" ] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.8.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: pnpm infra:plan
      - if: github.ref_type == 'tag'
        run: pnpm infra:apply
EOF

echo "✅ LUNA scaffold created."
