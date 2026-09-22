create TABLE users(
    -- id int primary ,
    id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY ,
    name varchar NOT NULL,
    email varchar(250) UNIQUE NOT NULL,
    password_hash varchar NOT NULL,
    -- default is for automatic timestamp
    created_at timestamptz DEFAULT now()
);


create TABLE projects(
    id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY ,
    name varchar NOT NULL,
    description text,
    deadline date ,
    -- restrict isliye kyuki foregin key hai
    owner_id int NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now()
);

-- // to serve many to many relation from users to projects

create TABLE project_members(
    project_id int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   -- //cascade means chil row delte when parent row record bhi delete hon
    primary KEY(project_id,user_id)
);


create TABLE tasks(
    id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title varchar NOT NULL ,
    description varchar ,
    priority varchar default 'medium' NOT NULL CHECK(priority IN ('low','medium','high')),
    status varchar default 'todo' NOT NULL CHECK(status IN ('todo','in_progress','done')),
    due_date date,
    project_id int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id int,
    created_by_user_id int REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    -- this makes the database reject an assignee who is not a member of the task's project
    FOREIGN KEY (project_id, assignee_id) REFERENCES project_members(project_id, user_id)
);
