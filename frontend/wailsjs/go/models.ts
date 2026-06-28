export namespace main {
	
	export class ActionResult {
	    name: string;
	    ok: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ActionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.ok = source["ok"];
	        this.error = source["error"];
	    }
	}
	export class View {
	    id: string;
	    name: string;
	    account: string;
	    services: string[];
	
	    static createFrom(source: any = {}) {
	        return new View(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.account = source["account"];
	        this.services = source["services"];
	    }
	}
	export class Config {
	    views: View[];
	    favorites: string[];
	    theme: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.views = this.convertValues(source["views"], View);
	        this.favorites = source["favorites"];
	        this.theme = source["theme"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceInfo {
	    name: string;
	    displayName: string;
	    state: string;
	    startType: string;
	    pid: number;
	    account: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.state = source["state"];
	        this.startType = source["startType"];
	        this.pid = source["pid"];
	        this.account = source["account"];
	        this.description = source["description"];
	    }
	}

}

