import { ref } from 'vue'

import {Cite as Citejs,plugins}  from "@citation-js/core"
import "@citation-js/plugin-bibtex"
import "@citation-js/plugin-csl"
//import "@citation-js/plugin-doi"
import sliconfig from "/@slidev/configs"


export const citation_state = 
{
   default_config:
   {
      template: 'vancouver',
      locale: 'en-US',
      numerical_ref: false,
      tooltips: false,
      footnotes: 'none',
      item_per_page: undefined,
      show_full_bib: false,
      show_id: undefined
   },
   state: {
    cite: undefined,
    nitem: 1,
    is_init: false,
    bibprop: {},
    version: ref(0),
    config: {},
    process_all: false,
  },
  init() {
       const config = sliconfig?.biblio 
       this.state.config = { ... this.default_config , ...config}
       
       if (!this.state.is_init) {
         this.state.is_init = true
         console.log('init')
         console.log("citation-js parser loaded:", plugins.list())
           
         let filenames = []
      	 if (Array.isArray(config.filename)) {
	         filenames = config.filename
	       }
	       else{
	         filenames = [config.filename]
	       }
	       const load_func = f => {console.log("biblio load : ",f); return fetch("/biblio/"+f+"?raw")
                .then(r => { if( ! r.ok) { throw new Error("invalid file"+f);  } else { return r.text()} })
	              .catch( err => { return f } )
		            .then( t => this.add_ref(t))
	              .catch( err => {console.log(err); return Promise.resolve(this.state.cite) } )
	       }
	       return Promise.all(filenames.map(load_func))
                       .then( () => this.state.cite)
       } else{
         return  Promise.resolve( this.state.cite  )  
       }
  },
  add_ref(input){
    //console.log("add_ref",input)
    if (this.state.cite)
      this.state.cite = this.state.cite.add(input)
    else
      this.state.cite = Citejs(input)
    this.update_full_bib()
    this.state.version.value += 1
    return this.state.cite
  },
  update_full_bib(){ 
    if (!this.state.cite)
      return
    
    this.state.bib_other = {}
    // update full bib
    const bib_ids = this.state.cite.getIds()
    let bib_id_order = {}
    Object.keys(this.state.bibprop).forEach(k => {let idx = bib_ids.indexOf(k); if (idx!=-1) {bib_id_order[k] = idx} })
    const nknow = Object.keys(bib_id_order).length
    if ( this.state.process_all)
      bib_ids.forEach( (k,i) => { if (!(k in bib_id_order)) {bib_id_order[k] = i} })
    
    let biblios = this.state.cite.format('bibliography',{ entry: Object.keys(bib_id_order), 
      template: this.state.config.template,
      lang:  this.state.config.locale,
      asEntryArray: true,
      nosort: false 
    })
    let mbiblios = Object.fromEntries(biblios)

    this.state.biborder_full = biblios.map( x => x[0] )
    this.state.biborder = this.state.biborder_full.filter(x => x in this.state.bibprop )
    Object.entries(bib_id_order).forEach( ([id,v],i) => 
    {
      const bib = mbiblios[id]
      let x = this.state.cite.data[v] //bib_id_order[id]]
      const etal = (x.author.length >1 )? "" : " et al."
      const short_bib = x.author[0].given[0] + ". " + x.author[0].family + etal +" , " + x.title
      
      if (i < nknow)
      {
         this.state.bibprop[id]["full_bib"] = bib //biblios[i][1]
         this.state.bibprop[id]["short_bib"] = short_bib
         this.state.bibprop[id]["id"] = id
         if (this.state.config.numerical_ref){
           this.state.bibprop[id]["cite_id"] = "["+this.state.bibprop[id].idx+"]"
         }else {
	         this.state.bibprop[id]["cite_id"] = this.state.cite.format("citation",
		       { entry: id
	         , template: this.state.config.template
	         , citationsPre: Object.keys(bib_id_order).slice(0,i) } 
	       )}
      }
      else {
        this.state.bib_other[id] = {'full_bib': bib, 'short_bib': short_bib , 'cite_id': '['+id+']', 'id': id }
      }
    })
  },
  add(id, page){
   if (!(id in this.state.bibprop))
   {
    this.state.bibprop[id] = {"pages": [], "idx": this.state.nitem}
    this.state.nitem += 1
    this.update_full_bib() // TODO only update id
   }

   if ( page && !(this.state.bibprop[id].pages.includes(page)))
   {
     this.state.bibprop[id].pages.push(page)
   }
  },
  process_all()
  {
    this.state.process_all = true
    this.update_full_bib()
  },
  get(id) {
    return this.state.bibprop[id] ?? this.state.bib_other[id] ?? undefined
  },
  get_know_ids()
  {
    return this.state.biborder
  },
  get_all_ids()
  {
    return this.state.biborder_full
  },
  get_bibpage(){
    return this.state.bibprop['bib'].pages[0]
  },
  get_allbibinpage(page){
    let same_page_id = []
    let same_page_idx = []
    for ( const [k,v] of Object.entries(this.state.bibprop))
    {
        if (v.pages.includes(page)){
          same_page_id.push(k)
          same_page_idx.push(v.idx)
        }
    }
    return [same_page_idx,same_page_id]
  }
}
