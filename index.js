const express =require("express");
const app = express();
const path= require('path')
const sqlite3= require('sqlite3').verbose();
const jwt= require('jsonwebtoken')
const bcrypt= require("bcryptjs")
const cookieParser= require("cookie-parser")
const bodyParser = require("body-parser")
app .use(bodyParser.urlencoded({ extended: false })); 
app.use(bodyParser.json());

app.set("view engine","ejs");
app.set("views",__dirname+"/views");
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const db_name=path.join(__dirname,'data','notesdb.db');
const db=new sqlite3.Database(db_name,err=>{
    if(err){
        return console.error(err.message);
    }
    console.log("Successfully connected to the notesdb.db database");
});
const user_table=`CREATE TABLE IF NOT EXISTS user(
    user_id INTEGER PRIMARY KEY,
    name varchar(100) NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);`
const note_table=`CREATE TABLE IF NOT EXISTS note(note_id INTEGER PRIMARY KEY,title TEXT NOT NULL,
    content TEXT NOT NULL, owner_id INTEGER NOT NULL);`

const sample_user=`INSERT INTO user(name,email,password) VALUES
("sample name","sample.com","1234");`

const sample_note=`INSERT INTO note(title,content,owner_id)VALUES ("title1","content1",10);`

// db.run(user_table,err=>{
//     if(err){
//         return console.log(err.message)
//     }
//     console.log("new user table created..!")
// });
// db.run(note_table,err=>{
//     if(err){
//         // console.log(err)
//         return console.log(err.message)
//     }
//     console.log("new note table created..!")
// });

// db.run(sample_user,err=>{
//     if(err){
//         return console.log(err.message)
//     }
//     console.log("sample user created..!")
// });
// db.run(sample_note,err=>{
//     if(err){
//         // console.log(err)
//         return console.log(err.message)
//     }
//     console.log("sample note created..!")
// });

const Authenticated=(req,res,next)=>{
    const token = req.cookies.access_token
    if(!token){
        return res.render("main",{error:"Unauthorized call"})
    }
    try{
        const data=jwt.verify(token,"1234")
        req.user_id=data.user_id
        return next();
    }catch(err){
        return res.json("Invaid token")
    }
}

const create_note=(req,res,next)=>{
    if(!req.body.title || !req.body.content){
        return next();
    }
    const sql=`INSERT INTO note(title,content,owner_id)VALUES(?,?,?);`
    const inputs=[req.body.title,req.body.content,req.user_id];
    db.run(sql,inputs,err=>{
        if(err){
            return console.log(err.message);
        }
        return next();
    })
}


app.get("/fetch_users",(req,res)=>{
    const sql=`SELECT * FROM user`
    db.all(sql,[],(err,rows)=>{
        if(err){
            return console.log(err.message)
        }
        res.json({'data':rows})
    });
});

app.get("/fetch_notes",(req,res)=>{
    const sql=`SELECT * FROM note`
    db.all(sql,[],(err,rows)=>{
        if(err){
            return console.log(err.message)
        }
        res.json({'data':rows})
    });
});

app.post('/create_user',(req,res)=>{
    const sql=`INSERT INTO user(name,email,password) VALUES(?,?,?);`
    const array=[req.body.name,req.body.email,req.body.password];
    db.run(sql,array,err=>{
        if(err){
            return console.log(err.message);
        }
        res.redirect("fetch_users")
    })
});

app.post("/delete/:id",(req,res)=>{
    const id=req.params.id
    const sql=`DELETE FROM user WHERE user_id=?;`
    db.run(sql,id,err=>{
        if(err){
            return console.log(err.message)
        }
        res.redirect("fetch_users")
    })
})

app.get("/home",function(req,res){
    res.render("main",{error:""})
});

app.all("/signup_page",(req,res)=>{
    if(req.method=="GET"){
        res.render("signup_page",{model:{},error:{}})
    }
    else if(req.method=="POST"){
        // const data=req.body
        if(!req.body.name || !req.body.email ||!req.body.password || !req.body.password || !req.body.confirm_password){
            res.render("signup_page",{model:req.body,error:{'msg':"Can't register..Something is blank"}})
        }
        else if(req.body.password!=req.body.confirm_password){
            res.render("signup_page",{model:req.body,error:{'msg':"Can't register..Confirm password didn't match"}})
        }
        bcrypt.hash(req.body.password,10,(err,hash)=>{
            if(err){
                return console.log(err.message)
            }
            const sql=`INSERT INTO user(name,email,password)VALUES(?,?,?);`
            const inputs=[req.body.name,req.body.email,hash]
            db.run(sql,inputs,sql_err=>{
                if(sql_err){
                    console.log("sql error 19 here")
                    return res.render("main",{model:{},error:{'msg':"error 19"}})
                }
            })

        })
        res.redirect("home")
    }
});

app.post("/signin",(req,res)=>{
    const sql=`SELECT * FROM user WHERE email=?`;
    db.get(sql,req.body.email,(err,row)=>{
        if(err){
            return console.log(err.message)
        }
        if(!row){
            res.render("main",{error:"Invalid User"})
            return;
        }
        bcrypt.compare(req.body.password,row.password,(bc_err,result)=>{
            if(bc_err){
                console.log(bc_err.message)
                return res.render("main",{error:"Something went wrong"})
            }
            if(result){
                row.password=undefined;
                const token= jwt.sign({user_id:row.user_id},"1234",{expiresIn:"1h"});
                // token=token+"abcd";//will throw invalid token error
                return res.cookie('access_token',token, { httpOnly: true, secure: true, maxAge: 3600000 }).redirect("notes")
                // return res.redirect("notes")
            }
            else{
                res.render("main",{error:"Invalid User"})
            }
        })
    })
});

app.get("/logout",Authenticated,(req,res)=>{
    return res.clearCookie("access_token").status(200).redirect("home")
})


const get_notes=(req,res,next)=>{
    const sql=`SELECT * FROM note WHERE owner_id=?;`
    db.all(sql,[req.user_id],(err,rows)=>{
        if(err){
            console.log(err.message)
            return res.render("main",{error:err.message})
        }
        req.notes=rows
        return next();
    })
}


app.get("/notes",Authenticated,get_notes,(req,res)=>{
    return res.render("all_notes",{rows:req.notes})
});

app.post("/add_note",Authenticated,create_note,(req,res)=>{
        return res.redirect("notes")
});

const RemoveNote=(req,res,next)=>{
    const id= req.params.note_id
    const sql=`DELETE FROM note WHERE note_id=?;`
    db.run(sql,id,err=>{
        if(err){
            return console.log(err.message);
        }
    })
    req.method="GET"
    return next();
}

app.post("/delete_note/:note_id",Authenticated,RemoveNote,(req,res)=>{
    return res.redirect("/notes")
})

const EditNote=(req,res,next)=>{
    if(req.method=="GET"){
        req.edit=true;
        const sql=`SELECT * FROM note WHERE note_id=?;`
        db.get(sql,req.params.note_id,(err,row)=>{
            if(err){
                return console.log(err.message)
            }
            if(row){
                // console.log(row)
                req.edit_note=row
            }
        })
        return next();
    }
}

app.all("/edit_note/:note_id",Authenticated,get_notes,(req,res)=>{
    if(req.method=="GET"){
        const sql=`SELECT * FROM note WHERE note_id=? LIMIT 1;`
        db.get(sql,req.params.note_id,(err,row)=>{
            if(err){
                return console.log(err.message)
            }
            if(row){
                console.log(row)
                return res.render("edit_note",{row:row})
            }
        })
    }
    if(req.method=="POST"){
        console.log(req.body)
        const sql=`UPDATE note SET title=?,content=? WHERE note_id=?`
        db.run(sql,[req.body.title,req.body.content,req.params.note_id],err=>{
            if(err){
                return console.log(err.message)
            }
            return res.redirect("/notes")
        })
    
    }
    
})


app.listen(3000,function(err){
    if(err){
        return console.log(err.message)
    }
    console.log("Server running on :3000 port....")
});
