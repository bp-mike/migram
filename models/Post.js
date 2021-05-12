const postsCollection = require('../db').db().collection('posts')
const followsCollection = require('../db').db().collection('follows')
const ObjectID = require('mongodb').ObjectID
const User = require('./User')
const sanitizeHTML = require('sanitize-html')

// constructors
let Post = function(data, userid, requestedPostId){
  this.data = data
  this.userid = userid
  this.errors = []
  this.requestedPostId = requestedPostId
}

Post.prototype.cleanUp = function(){
  if(typeof(this.data.title) != 'string'){this.data.title = ''}
  if(typeof(this.data.body) != 'string'){this.data.body = ''}

  //____ get rid of useless properties
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {allowedTags: [], allowsAttributes: []}),
    body: sanitizeHTML(this.data.body.trim(), {allowedTags: [], allowsAttributes: []}),
    createdDate: new Date(),
    author:ObjectID(this.userid)
  }
}

Post.prototype.validate = function(){
  if(this.data.title == ""){this.errors.push("you must provide a title")}
    if(this.data.body == ""){this.errors.push("you must provide post content")}
}

Post.prototype.create = function(){
  return new Promise((resolve, reject) =>{
    this.cleanUp()
    this.validate()
    //check if their are errrors
    postsCollection.insertOne(this.data).then((info) =>{
      resolve(info.ops[0]._id)
    }).catch(() =>{
      this.errors.push('please try again later')
      reject(this.errors)
    })

    if(!this.errors.length){
      //save is their are no errors
    }else{
      //
      reject(this.errors)
    }
  })
}

Post.prototype.update = function(){
  return new Promise( async (resolve, reject) =>{
    try{
      let post = await Post.findSingleById(this.requestedPostId, this.userid)
      //____ update db only if owner updates it
      if(post.isVisitorOwner){
        let status = await this.actuallyUpdate()
        resolve(status)
      }else{
        reject()
      }
    }catch{
      reject()
    }
  })
}

Post.prototype.actuallyUpdate = function(){
  return new Promise(async (resolve, reject) =>{
    this.cleanUp()
    this.validate()
    if(!this.errors.length){
      await postsCollection.findOneAndUpdate({_id: new ObjectID(this.requestedPostId)}, {$set: {title:this.data.title, body: this.data.body}})
      resolve("success")
    }else{
      resolve("failure")
    }
  })
}

Post.reusablePostQuery = function(uniqueOperations, visitorId){
  return new Promise( async (resolve, reject) =>{
    let aggOperations = uniqueOperations.concat([
      {$lookup: {from: "users", localField: "author", foreignField:"_id", as: "authorDocument"}},
      {$project: {
        title:1,
        body: 1,
        createdDate: 1,
        authorId: "$author",
        author: {$arrayElemAt: ['$authorDocument',0]}
      }}
    ])
    let posts = await postsCollection.aggregate(aggOperations).toArray()

    //___ cleanUp author property in each post object
    posts = posts.map((post) =>{
      post.isVisitorOwner = post.authorId.equals(visitorId)
      // post.authorId = undefined
      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar
      }
      return post
    })
    resolve(posts)
  })
}

Post.findSingleById = function(id, visitorId){
  return new Promise( async (resolve, reject) =>{
    if(typeof(id) != "string" || !ObjectID.isValid(id) ){
      reject()
      return
    }

    let posts = await Post.reusablePostQuery([
      {$match :{_id: new ObjectID(id)}}
    ], visitorId)

    if(posts.length){
      console.log(posts[0]);
      resolve(posts[0])
    }else{
      reject()
    }
  })
}

Post.findByAuthorId = function(authorId){
  return Post.reusablePostQuery([
    {$match: {author: authorId}},
    {$sort: {createdDate: -1}}
  ])
}

Post.delete = function(postIdToDelete, currentUserId){
  return new Promise(async (resolve, reject) =>{
    try{
      let post = await Post.findSingleById(postIdToDelete, currentUserId)
      if(post.isVisitorOwner){
        await  postsCollection.deleteOne({_id: new ObjectID(postIdToDelete)})
        resolve()
      }else {
        reject()
      }
    }catch{
      reject()
    }
  })
}

Post.search = function(searchTerm){
  return new Promise(async (resolve, reject) =>{
    if(typeof(searchTerm) == "string"){
      let posts = await Post.reusablePostQuery([
        {$match: {$text: {$search: searchTerm}}},
        {$sort: {score: {$meta: "textScore"}}}
      ])
      resolve(posts)
    }else{
      reject()
    }
  })
}

Post.countPostsByAuthor = function(id){
  return new Promise(async (resolve, reject) =>{
    let postCount = await postsCollection.countDocuments({author: id})
    resolve(postCount)
  })
}

Post.getFeed = async function(id){
  //___ create an array of the user ids that the current user follows
  let followedUsers = await followsCollection.find({authorId: new ObjectID(id)}).toArray()
  followedUsers = followedUsers.map((followDoc) =>{
    return followDoc.followedId
  })
  //____ look for posts were the author is in the above of followed users
  return Post.reusablePostQuery([
    {$match: {author: {$in: followedUsers}}},
    {$sort: {createdDate: -1}}
  ])
}

module.exports = Post
