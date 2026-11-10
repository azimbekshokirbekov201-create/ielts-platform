"use client";
import { useState } from "react";

type Item = { id:number; answer:string|string[]; label?:string; after?:string; options?:unknown[] };
type Group = { type:string; title:string; instruction?:string; wordLimit?:number; items:Item[]; people?:unknown[] };
type Passage = { title:string; content:string; headings?:{id:string;text:string}[] };
type ImportData = { passages:Record<string,Passage>; sections:Record<string,Group[]>; explanations:Record<string,unknown> };
function extract(source:string, name:string):unknown {
  const match = new RegExp("const\\s+"+name+"\\s*=\\s*").exec(source);
  if (!match) throw Error(name+" not found. Only CDI Reading HTML is supported.");
  const start=match.index+match[0].length;
  if(source[start]!=="{") throw Error(name+" must be a JSON object.");
  let depth=0, quoted=false, escaped=false;
  for(let i=start;i<source.length;i++){
    const c=source[i];
    if(quoted){if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==="{")depth++;
    if(c==="}"){depth--;if(depth===0) return JSON.parse(source.slice(start,i+1));}
  }
  throw Error("Incomplete "+name);
}
function clean(value:string):string {
  return value.replace(/<[^>]*>/g," ").replace(/&ndash;/g,"–").replace(/&rsquo;/g,"’").replace(/&lsquo;/g,"‘").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
}
function parse(source:string):ImportData{
  if(source.length>5_000_000)throw Error("HTML file exceeds 5 MB.");
  const sections=extract(source,"SECTIONS") as Record<string,Group[]>;
  const passages=extract(source,"PASSAGES") as Record<string,Passage>;
  const explanations=extract(source,"READING_EXPLANATIONS") as Record<string,unknown>;
  if(!Object.keys(passages).length || !Object.keys(sections).length)throw Error("No Reading content found.");
  return {passages,sections,explanations};
}
async function api(path:string, body:unknown):Promise<Record<string,unknown>>{
  const response=await fetch("/api/admin/content/"+path,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const json=await response.json();
  if(!response.ok)throw Error(path+": "+(json.error||response.status));
  return json.data;
}
export default function HtmlImportPage(){
  const [data,setData]=useState<ImportData|null>(null);
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [progress,setProgress]=useState("");
  const count=data?Object.values(data.sections).flatMap(x=>x.flatMap(g=>g.items||[])).length:0;
  async function upload(file:File|undefined){
    if(!file)return;
    setMessage("");setData(null);setName(file.name.replace(/\.html?$/i,""));
    try{
      if(!/\.html?$/i.test(file.name))throw Error("Select an .html file.");
      const parsed=parse(await file.text());
      setData(parsed);
    }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  }
  async function save(){
    if(!data||busy)return;
    setBusy(true);setMessage("");
    try{
      const test=await api("tests",{title:name.slice(0,200)||"Imported Reading Test",description:"Imported from CDI HTML; review questions and answer keys before publishing.",status:"draft",skill:"reading",variant:"academic",duration_seconds:3600});
      for(const [part,passage] of Object.entries(data.passages)){
        setProgress("Importing passage "+part+"...");
        const section=await api("test_sections",{test_id:test.id,title:"Reading Passage "+part,position:Number(part)-1});
        // Strip active HTML and embedded scripts; only plain passage text enters the database.
        await api("passages",{section_id:section.id,title:clean(passage.title).slice(0,200),body:clean(passage.content).slice(0,50000)});
        let position=0;
        for(const group of data.sections[part]||[]){
          for(const item of group.items||[]){
            const prompt=clean(item.label||("Match paragraph "+String(item.id))).slice(0,200)||("Question "+item.id);
            const kind=group.type==="tfng"?"true_false_not_given":group.type==="mcq"?"choice":group.type.startsWith("matching")?"matching":"text";
            const question=await api("questions",{section_id:section.id,prompt,kind,position:position++,points:1,...(group.wordLimit?{max_words:group.wordLimit}:{})});
            if(Array.isArray(item.options)){
              for(let i=0;i<item.options.length;i++){
                const raw=item.options[i];
                const label=typeof raw==="string"?raw:raw&&typeof raw==="object"?"text" in raw?String(raw.text):"label" in raw?String(raw.label):String(raw):String(raw);
                await api("question_options",{question_id:question.id,label:clean(label).slice(0,200),value:String.fromCharCode(65+i)});
              }
            }
            if(group.type==="matching-headings" && passage.headings){
              for(const h of passage.headings)await api("question_options",{question_id:question.id,label:clean(h.text).slice(0,200),value:String(h.id).slice(0,200)});
            }
            if(group.type==="matching-features" && Array.isArray(group.people)){
              for(let i=0;i<group.people.length;i++){
                const p=group.people[i] as unknown;
                const label=typeof p==="string"?p:p&&typeof p==="object"&&"text" in p?String(p.text):String(p);
                await api("question_options",{question_id:question.id,label:clean(label).slice(0,200),value:String.fromCharCode(65+i)});
              }
            }
            const accepted=(Array.isArray(item.answer)?item.answer:[item.answer]).map(String).filter(Boolean);
            if(accepted.length)await api("answer_keys",{question_id:question.id,accepted,explanation:""});
          }
        }
      }
      setMessage("Imported as DRAFT. Review in Content Studio before publishing.");
      setProgress("");
    }catch(e){setMessage("Import stopped: "+(e instanceof Error?e.message:String(e))+". Any previously created draft content may need cleanup.");}
    finally{setBusy(false);}
  }
  return <main style={{maxWidth:850,margin:"40px auto",padding:24,fontFamily:"Arial,sans-serif"}}>
    <a href="/admin">← Admin</a><h1>CD IELTS HTML Importer</h1>
    <p>Import a CDI Reading HTML file into the platform as a draft test. Only admins and authorized content editors can save. Uploaded scripts are never executed.</p>
    <input aria-label="Choose HTML test" type="file" accept=".html,.htm,text/html" onChange={e=>void upload(e.target.files?.[0])}/>
    {data&&<section style={{marginTop:24}}>
      <label>Test title <input value={name} maxLength={200} onChange={e=>setName(e.target.value)} style={{display:"block",width:"100%",padding:10,marginTop:8}}/></label>
      <p><strong>{Object.keys(data.passages).length} passages · {count} questions · {Object.keys(data.explanations).length} explanations in source</strong></p>
      <p>Explanations are not imported yet. Embedded passage images and advanced drag-and-drop layouts may require manual editing. Check all answer keys before publishing.</p>
      <button type="button" disabled={busy} onClick={()=>void save()} style={{padding:"12px 20px",cursor:busy?"wait":"pointer"}}>{busy?"Importing...":"Import as draft"}</button>
    </section>}
    {progress&&<p role="status">{progress}</p>}{message&&<p role="status">{message}</p>}
  </main>;
}
